package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// spotifyPlayerURL es la base de todos los endpoints de control de reproducción de Spotify.
// Todos los comandos del reproductor (play, pause, next, previous) son sub-rutas de esta URL.
const spotifyPlayerURL = "https://api.spotify.com/v1/me/player"

// upgrader es el componente que convierte una conexión HTTP normal en una conexión WebSocket.
//
// El proceso de "upgrade" funciona así:
//  1. El frontend hace GET /api/v1/ws con el header "Upgrade: websocket"
//  2. El upgrader valida que el origen sea permitido (CheckOrigin)
//  3. Si es válido, negocia el protocolo y devuelve una conexión WebSocket bidireccional
//  4. A partir de ahí, ambos lados pueden enviarse mensajes en cualquier momento sin hacer nuevos requests
//
// CheckOrigin es una función de seguridad que decide si se acepta la conexión.
// En producción solo se acepta desde el dominio del frontend desplegado.
// En desarrollo se acepta solo desde localhost:5173 (puerto de Vite).
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		// Permitir conexiones del frontend autorizado o sin Origin (herramientas como Postman)
		return origin == "http://localhost:5173" || origin == ""
	},
}

// wsInMessage es la estructura que el frontend debe enviar por el WebSocket.
type wsInMessage struct {
	Action string `json:"action"`          // play | pause | next | previous | update_token
	Token  string `json:"token,omitempty"` // solo requerido para la acción update_token
}

// sessionState guarda el estado mutable de una conexión WebSocket activa.
// authHeader se puede actualizar en caliente cuando el frontend refresca el token,
// sin necesidad de cerrar y reabrir la conexión.
type sessionState struct {
	authHeader string // "Bearer <spotify_access_token>" actualizable via update_token
}

// wsOutMessage representa la respuesta del backend al frontend.
type wsOutMessage struct {
	Event   string `json:"event"`             // ok | error
	Action  string `json:"action"`            // acción que originó el evento
	Message string `json:"message,omitempty"` // detalle del error — omitido si está vacío
}

// WSHandler gestiona la conexión WebSocket de una sesión de entrenamiento.
// Recibe comandos del frontend, los ejecuta contra la Spotify Web API
// y devuelve el resultado por el mismo canal.
//
// Un WSHandler es creado una sola vez al iniciar el servidor y es compartido
// entre todas las conexiones (es stateless — no guarda estado por usuario).
// Cada conexión tiene su propio goroutine gestionado por Gin.
type WSHandler struct {
	// httpClient es el cliente HTTP reutilizable para llamar a la Spotify API.
	// Reutilizarlo es importante para aprovechar el connection pooling de Go
	// y no crear/destruir conexiones TCP en cada llamada.
	httpClient *http.Client
}

func NewWSHandler() *WSHandler {
	return &WSHandler{httpClient: &http.Client{}}
}


// El token se pasa como query param porque los browsers no permiten
// enviar headers Authorization en la apertura de una conexión WebSocket.
func (h *WSHandler) HandleSession(c *gin.Context) {
	// Leer el token del query param — los browsers no permiten headers en WS
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		// Si no hay token, rechazar antes del upgrade (todavía es HTTP aquí)
		c.JSON(http.StatusUnauthorized, errorResponse("missing token query param", nil))
		return
	}

	// Intentar hacer el upgrade HTTP → WebSocket.
	// Si el cliente no envió los headers correctos de WS, gorilla responde automáticamente
	// con HTTP 400 y retorna error — no necesitamos manejar el error de respuesta manualmente.
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	// defer conn.Close() garantiza que la conexión se cierre cuando HandleSession retorne,
	// sin importar si fue por error, cierre del cliente o fin normal.
	defer conn.Close()

	// sessionState encapsula el authHeader como estado mutable de esta conexión.
	// Cuando el token expira, el frontend puede enviar update_token y el backend
	// actualiza state.authHeader sin cerrar la conexión WebSocket.
	state := &sessionState{authHeader: "Bearer " + token}

	// Bucle principal de la sesión.
	// Se ejecuta indefinidamente hasta que el cliente cierra la conexión o hay un error de red.
	// Gin ya ejecuta HandleSession en su propia goroutine, así que este bucle bloquea
	// solo ese goroutine — no afecta a otros usuarios conectados.
	for {
		// ReadMessage bloquea hasta que llegue un mensaje del cliente.
		// Retorna error cuando el cliente cierra la conexión (websocket.CloseMessage)
		// o cuando hay un problema de red — en ambos casos salimos del bucle.
		_, raw, err := conn.ReadMessage()
		if err != nil {
			// Cierre normal o error de red — terminar el loop y cerrar la conexión
			break
		}

		// Parsear el JSON recibido al struct wsInMessage
		var msg wsInMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			// JSON inválido — notificar al cliente y continuar esperando el siguiente mensaje
			h.writeOut(conn, wsOutMessage{Event: "error", Message: "invalid message format"})
			continue
		}

		// Ejecutar la acción y responder al cliente.
		// dispatch retorna error solo para errores de validación (acción desconocida, token vacío).
		// Los errores de Spotify (incluido 401) se escriben directamente al WS desde callSpotify.
		if err := h.dispatch(conn, msg, state); err != nil {
			h.writeOut(conn, wsOutMessage{Event: "error", Action: msg.Action, Message: err.Error()})
		}
	}
}

// dispatch actúa como un router interno: mapea cada acción a su endpoint de Spotify.
// Recibe *sessionState para poder mutar authHeader cuando llega update_token.
func (h *WSHandler) dispatch(conn *websocket.Conn, msg wsInMessage, state *sessionState) error {
	switch msg.Action {
	case "update_token":
		// El frontend envía un nuevo token cuando el anterior expiró (vida útil: 1 hora).
		// El backend actualiza authHeader en memoria — la conexión WS sigue abierta.
		// Flujo esperado:
		//   1. Backend detecta 401 → envía { event: "token_expired", action: "..." }
		//   2. Frontend refresca el token con Spotify
		//   3. Frontend envía { action: "update_token", token: "nuevo_BQD..." }
		//   4. Frontend reintenta la acción original
		newToken := strings.TrimSpace(msg.Token)
		if newToken == "" {
			return fmt.Errorf("token is required for update_token action")
		}
		state.authHeader = "Bearer " + newToken
		h.writeOut(conn, wsOutMessage{Event: "ok", Action: "update_token"})
		return nil

	case "play":
		// PUT /me/player/play sin body → reanuda la reproducción de la cola existente.
		// Las canciones ya fueron encoladas por POST /api/v1/sessions antes de conectar el WS.
		return h.callSpotify(conn, msg.Action, http.MethodPut, spotifyPlayerURL+"/play", state.authHeader, nil)

	case "pause":
		// PUT /me/player/pause — no necesita body ni URI
		return h.callSpotify(conn, msg.Action, http.MethodPut, spotifyPlayerURL+"/pause", state.authHeader, nil)

	case "next":
		// POST /me/player/next — avanza al siguiente track en la cola de Spotify
		return h.callSpotify(conn, msg.Action, http.MethodPost, spotifyPlayerURL+"/next", state.authHeader, nil)

	case "previous":
		// POST /me/player/previous — vuelve al track anterior
		return h.callSpotify(conn, msg.Action, http.MethodPost, spotifyPlayerURL+"/previous", state.authHeader, nil)

	default:
		return fmt.Errorf("unknown action: %s", msg.Action)
	}
}

// callSpotify es el método central que ejecuta cualquier llamada a la Spotify Web API.
// Construye el request HTTP, lo envía, y escribe el resultado de vuelta al cliente WS.
//
// Parámetros:
//   - conn:       conexión WebSocket del cliente para responderle
//   - action:     nombre de la acción (para incluirlo en la respuesta)
//   - method:     HTTP method (PUT, POST)
//   - url:        endpoint completo de Spotify
//   - authHeader: "Bearer <token>"
//   - body:       body JSON opcional (nil para pause/next/previous)
func (h *WSHandler) callSpotify(conn *websocket.Conn, action, method, url, authHeader string, body map[string]any) error {
	// Preparar el body del request
	var reqBody *bytes.Reader
	if body != nil {
		// Serializar el body a JSON si hay datos que enviar (solo en "play")
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	} else {
		// Spotify requiere un body vacío (no nil) en sus endpoints PUT/POST sin body.
		// Si pasáramos nil, el servidor de Spotify podría rechazar el request.
		reqBody = bytes.NewReader([]byte{})
	}

	// Crear el request con contexto para poder cancelarlo si fuera necesario en el futuro
	req, err := http.NewRequestWithContext(context.Background(), method, url, reqBody)
	if err != nil {
		return fmt.Errorf("failed to build spotify request")
	}

	// El token de Spotify va en el header Authorization de cada request HTTP
	req.Header.Set("Authorization", authHeader)
	if body != nil {
		// Solo agregar Content-Type cuando hay body JSON, para no confundir a Spotify
		req.Header.Set("Content-Type", "application/json")
	}

	// Ejecutar el request contra la Spotify API
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach Spotify")
	}
	// defer garantiza que el body de la respuesta se cierra al salir,
	// liberando la conexión TCP al pool para reutilizarla
	defer resp.Body.Close()

	// Spotify devuelve 204 normalmente, pero puede responder cualquier 2xx como éxito
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		// Notificar al frontend que la acción se ejecutó correctamente
		h.writeOut(conn, wsOutMessage{Event: "ok", Action: action})
		return nil
	}

	// 401 Unauthorized = el token de Spotify expiró.
	// En lugar de retornar un error genérico, notificamos al frontend con el evento
	// "token_expired" para que pueda refrescar el token y enviarlo via update_token.
	if resp.StatusCode == http.StatusUnauthorized {
		h.writeOut(conn, wsOutMessage{
			Event:   "token_expired",
			Action:  action,
			Message: "send update_token with a new spotify access token",
		})
		return nil
	}

	// Cualquier otro status fuera del rango 2xx es un error de Spotify (403, 404, etc.)
	var spotifyErr any
	json.NewDecoder(resp.Body).Decode(&spotifyErr)
	return fmt.Errorf("spotify returned %d", resp.StatusCode)
}

// writeOut serializa un wsOutMessage a JSON y lo envía por el canal WebSocket.
// Es el único punto de escritura al WebSocket — centralizado para facilitar
// agregar logging o métricas en el futuro.
func (h *WSHandler) writeOut(conn *websocket.Conn, msg wsOutMessage) {
	b, _ := json.Marshal(msg)
	// websocket.TextMessage indica que el payload es texto (JSON),
	// en contraste con websocket.BinaryMessage para datos binarios.
	conn.WriteMessage(websocket.TextMessage, b)
}

