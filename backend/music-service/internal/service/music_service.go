package service

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/adrianyebid/fitbeat/music-service/internal/model"
	"github.com/adrianyebid/fitbeat/music-service/internal/repository"
)

const (
	spotifySearchURL = "https://api.spotify.com/v1/search"
	spotifyQueueURL  = "https://api.spotify.com/v1/me/player/queue"
)

type CreateSessionInput struct {
	UserID       string
	ActivityType string
	Mode         string
	Genres       []string // géneros musicales preferidos del usuario
	Categories   []string // categorías preferidas del usuario
	SpotifyToken string   // access token de Spotify para buscar tracks
}

// CreateSessionOutput contiene solo la sesión creada.
// Los tracks ya fueron encolados directamente en Spotify.
type CreateSessionOutput struct {
	Session model.TrainingSession `json:"session"`
}

// EngineService implementa la lógica de creación y consulta de sesiones de entrenamiento.
type EngineService struct {
	repo       repository.EngineRepository
	httpClient *http.Client
	idCounter  uint64
}

func NewEngineService(repo repository.EngineRepository) *EngineService {
	return &EngineService{
		repo:       repo,
		httpClient: &http.Client{},
	}
}

// CreateSession orquesta la creación de una sesión de entrenamiento en 3 pasos:
// 1. Persiste la sesión en el repositorio
// 2. Busca tracks en Spotify en paralelo (Fase 1)
// 3. Encola todos los tracks encontrados en paralelo (Fase 2)
//
// El uso de goroutines reduce el tiempo de respuesta de ~11s (secuencial) a ~2-3s (paralelo).
func (s *EngineService) CreateSession(input CreateSessionInput) (CreateSessionOutput, error) {
	// Construir la sesión con un ID único basado en timestamp + contador atómico
	session := model.TrainingSession{
		ID:           s.nextID("session"),
		UserID:       strings.TrimSpace(input.UserID),
		ActivityType: strings.TrimSpace(input.ActivityType),
		Mode:         strings.TrimSpace(input.Mode),
		CreatedAt:    time.Now().UTC(),
	}

	// Persistir la sesión antes de llamar a Spotify.
	// Si falla aquí, no se hacen llamadas externas innecesarias.
	if err := s.repo.SaveSession(session); err != nil {
		return CreateSessionOutput{}, err
	}

	// ─────────────────────────────────────────────────────────────
	// FASE 1: Búsquedas en paralelo
	//
	// Problema anterior: 3 búsquedas secuenciales ≈ 3× latencia de Spotify (~1s c/u)
	// Solución: lanzar las 3 como goroutines simultáneas → tiempo total ≈ 1× latencia
	// ─────────────────────────────────────────────────────────────

	// searchResult empaqueta el resultado de una búsqueda (URIs encontrados o error).
	// Se define aquí adentro porque solo se usa en esta función.
	type searchResult struct {
		uris []string
		err  error
	}

	// Canal con buffer de capacidad 3 (una por goroutine).
	// El buffer es importante: permite que cada goroutine escriba su resultado
	// sin bloquearse esperando que alguien lea — todas pueden terminar libremente.
	resultsCh := make(chan searchResult, 3)

	// Lanzar las 3 búsquedas simultáneamente
	for i := 0; i < 3; i++ {
		// Elegir género y categoría al azar ANTES de lanzar la goroutine.
		// Esto es crítico: si lo hiciéramos adentro de la goroutine, el bucle
		// podría avanzar antes de que la goroutine lea las variables, causando
		// una condición de carrera (race condition) donde todas usarían el mismo valor.
		genre := input.Genres[rand.Intn(len(input.Genres))]
		category := input.Categories[rand.Intn(len(input.Categories))]

		// go func(...) lanza la función en una goroutine nueva (hilo ligero).
		// Los parámetros g y cat son copias locales — cada goroutine tiene los suyos.
		go func(g, cat string) {
			uris, err := s.searchSpotifyTrack(input.SpotifyToken, input.ActivityType, g, cat)
			// Escribir el resultado en el canal para que el bucle de abajo lo recoja
			resultsCh <- searchResult{uris, err}
		}(genre, category)
	}

	// Recolectar los 3 resultados del canal.
	// <-resultsCh bloquea hasta que llega un resultado — no importa el orden.
	// Como el canal tiene buffer 3, las goroutines ya terminaron antes de que lleguemos aquí.
	allURIs := make([]string, 0, 15)
	for i := 0; i < 3; i++ {
		r := <-resultsCh
		if r.err != nil {
			// Si cualquier búsqueda falló, abortamos todo
			return CreateSessionOutput{}, r.err
		}
		// Agregar los URIs de esta búsqueda al slice acumulador
		allURIs = append(allURIs, r.uris...)
	}

	// ─────────────────────────────────────────────────────────────
	// FASE 2: Enqueue en paralelo
	//
	// Problema anterior: 15 llamadas secuenciales a /queue ≈ 15× latencia (~0.5s c/u) ≈ 7.5s
	// Solución: lanzar las 15 como goroutines simultáneas → tiempo total ≈ 1× latencia
	// ─────────────────────────────────────────────────────────────

	// WaitGroup actúa como un contador de goroutines activas.
	// wg.Add(1) → suma 1 al contador
	// wg.Done() → resta 1 al contador
	// wg.Wait() → bloquea aquí hasta que el contador llega a 0
	var wg sync.WaitGroup

	// Canal de errores con buffer igual a la cantidad de goroutines.
	// Buffer necesario: si todas fallaran al mismo tiempo, cada una puede
	// escribir su error sin bloquearse esperando que alguien lo lea.
	errCh := make(chan error, len(allURIs))

	for _, uri := range allURIs {
		// Incrementar el contador ANTES de lanzar la goroutine,
		// nunca adentro — la goroutine podría tardar en arrancar.
		wg.Add(1)

		// Pasar uri como parámetro (no capturar del closure).
		// Si lo capturáramos, todas las goroutines compartirían la variable
		// del bucle y usarían el último valor cuando se ejecuten.
		go func(u string) {
			// defer garantiza que wg.Done() se llama siempre,
			// incluso si enqueueSpotifyTrack hace panic o retorna error.
			defer wg.Done()

			if err := s.enqueueSpotifyTrack(input.SpotifyToken, u); err != nil {
				// Escribir el error en el canal y continuar.
				// No podemos retornar el error directamente desde una goroutine.
				errCh <- err
			}
		}(uri)
	}

	// Esperar a que TODAS las goroutines de enqueue terminen antes de continuar.
	wg.Wait()

	// Cerrar el canal para que el range o la lectura siguiente sepa que no vendrán más valores.
	// Importante: cerrar DESPUÉS de wg.Wait(), cuando ya nadie escribe en el canal.
	close(errCh)

	// Leer el primer error que haya llegado (si hubo alguno).
	// Como el canal está cerrado, si estaba vacío devuelve el zero value de error (nil).
	if err := <-errCh; err != nil {
		return CreateSessionOutput{}, err
	}

	return CreateSessionOutput{Session: session}, nil
}

// enqueueSpotifyTrack agrega un track a la cola del dispositivo activo del usuario en Spotify.
func (s *EngineService) enqueueSpotifyTrack(token, uri string) error {
	params := url.Values{}
	params.Set("uri", uri)

	req, err := http.NewRequest(http.MethodPost, spotifyQueueURL+"?"+params.Encode(), nil)
	if err != nil {
		return fmt.Errorf("failed to build queue request")
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach Spotify queue")
	}
	defer resp.Body.Close()

	// Spotify devuelve 204 normalmente, pero acepta cualquier 2xx como éxito
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("spotify queue returned %d for uri %s", resp.StatusCode, uri)
	}

	return nil
}

// searchSpotifyTrack construye la query con deporte + género + categoría y llama a la Spotify Search API.
// Devuelve hasta 5 URIs por búsqueda.
func (s *EngineService) searchSpotifyTrack(token, activityType, genre, category string) ([]string, error) {
	// Query: "running pop workout" → Spotify busca tracks que coincidan con estos términos
	query := fmt.Sprintf("%s %s %s", activityType, genre, category)

	params := url.Values{}
	params.Set("q", query)
	params.Set("type", "track")
	params.Set("limit", "5")

	req, err := http.NewRequest(http.MethodGet, spotifySearchURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build spotify search request")
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to reach Spotify")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("spotify search returned %d", resp.StatusCode)
	}

	// Parsear solo los campos necesarios de la respuesta de Spotify
	var result struct {
		Tracks struct {
			Items []struct {
				URI string `json:"uri"`
			} `json:"items"`
		} `json:"tracks"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse spotify response")
	}

	uris := make([]string, 0, len(result.Tracks.Items))
	for _, item := range result.Tracks.Items {
		uris = append(uris, item.URI)
	}

	return uris, nil
}

func (s *EngineService) nextID(prefix string) string {
	n := atomic.AddUint64(&s.idCounter, 1)
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UTC().UnixNano(), n)
}

