package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/adrianyebid/fitbeat/music-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const spotifyPlayerURL = "https://api.spotify.com/v1/me/player"

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return origin == "http://localhost:5173" || origin == ""
	},
}

type wsInMessage struct {
	Action string `json:"action"`
	Token  string `json:"token,omitempty"`
}

type sessionState struct {
	authHeader string
	sessionID  string
}

type wsOutMessage struct {
	Event   string `json:"event"`
	Action  string `json:"action"`
	Message string `json:"message,omitempty"`
}

type WSHandler struct {
	httpClient *http.Client
	engine     *service.EngineService
}

func NewWSHandler(engine *service.EngineService) *WSHandler {
	return &WSHandler{
		httpClient: &http.Client{},
		engine:     engine,
	}
}

func (h *WSHandler) HandleSession(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	sessionID := strings.TrimSpace(c.Query("session_id"))
	if token == "" {
		c.JSON(http.StatusUnauthorized, errorResponse("missing token query param", nil))
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	state := &sessionState{
		authHeader: "Bearer " + token,
		sessionID:  sessionID,
	}

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg wsInMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			h.writeOut(conn, wsOutMessage{Event: "error", Message: "invalid message format"})
			continue
		}

		if err := h.dispatch(conn, msg, state); err != nil {
			h.writeOut(conn, wsOutMessage{Event: "error", Action: msg.Action, Message: err.Error()})
		}
	}
}

func (h *WSHandler) dispatch(conn *websocket.Conn, msg wsInMessage, state *sessionState) error {
	switch msg.Action {
	case "update_token":
		newToken := strings.TrimSpace(msg.Token)
		if newToken == "" {
			return fmt.Errorf("token is required for update_token action")
		}
		state.authHeader = "Bearer " + newToken
		h.writeOut(conn, wsOutMessage{Event: "ok", Action: "update_token"})
		return nil

	case "play":
		return h.callSpotify(conn, msg.Action, http.MethodPut, spotifyPlayerURL+"/play", state.authHeader, nil)

	case "pause":
		return h.callSpotify(conn, msg.Action, http.MethodPut, spotifyPlayerURL+"/pause", state.authHeader, nil)

	case "next":
		if err := h.callSpotify(conn, msg.Action, http.MethodPost, spotifyPlayerURL+"/next", state.authHeader, nil); err != nil {
			return err
		}
		if h.engine != nil {
			_ = h.engine.PublishTrackSkipped(state.sessionID)
		}
		return nil

	case "previous":
		return h.callSpotify(conn, msg.Action, http.MethodPost, spotifyPlayerURL+"/previous", state.authHeader, nil)

	default:
		return fmt.Errorf("unknown action: %s", msg.Action)
	}
}

func (h *WSHandler) callSpotify(conn *websocket.Conn, action, method, url, authHeader string, body map[string]any) error {
	var reqBody *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}

	req, err := http.NewRequestWithContext(context.Background(), method, url, reqBody)
	if err != nil {
		return fmt.Errorf("failed to build spotify request")
	}

	req.Header.Set("Authorization", authHeader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach Spotify")
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		h.writeOut(conn, wsOutMessage{Event: "ok", Action: action})
		return nil
	}

	if resp.StatusCode == http.StatusUnauthorized {
		h.writeOut(conn, wsOutMessage{
			Event:   "token_expired",
			Action:  action,
			Message: "send update_token with a new spotify access token",
		})
		return nil
	}

	return fmt.Errorf("spotify returned %d", resp.StatusCode)
}

func (h *WSHandler) writeOut(conn *websocket.Conn, msg wsOutMessage) {
	b, _ := json.Marshal(msg)
	conn.WriteMessage(websocket.TextMessage, b)
}
