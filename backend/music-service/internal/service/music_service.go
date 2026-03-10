package service

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"

	"github.com/adrianyebid/fitbeat/music-service/internal/model"
	"github.com/adrianyebid/fitbeat/music-service/internal/repository"
)

const spotifySearchURL = "https://api.spotify.com/v1/search"

var ErrSessionNotFound = fmt.Errorf("session not found")

type CreateSessionInput struct {
	UserID       string
	ActivityType string
	Mode         string
	Genres       []string // géneros musicales preferidos del usuario
	Moods        []string // moods preferidos del usuario
	SpotifyToken string   // access token de Spotify para buscar tracks
}

// CreateSessionOutput contiene la sesión creada y los URIs de tracks encontrados en Spotify.
type CreateSessionOutput struct {
	Session   model.TrainingSession `json:"session"`
	TrackURIs []string              `json:"track_uris"`
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

// CreateSession crea la sesión, busca un track en Spotify según deporte + género + mood aleatorios
// y devuelve la sesión junto con los URIs encontrados.
func (s *EngineService) CreateSession(input CreateSessionInput) (CreateSessionOutput, error) {
	session := model.TrainingSession{
		ID:           s.nextID("session"),
		UserID:       strings.TrimSpace(input.UserID),
		ActivityType: strings.TrimSpace(input.ActivityType),
		Mode:         strings.TrimSpace(input.Mode),
		CreatedAt:    time.Now().UTC(),
	}

	if err := s.repo.SaveSession(session); err != nil {
		return CreateSessionOutput{}, err
	}

	// 3 búsquedas con género y mood al azar, 5 tracks cada una → hasta 15 canciones en la playlist
	allURIs := make([]string, 0, 15)

	for i := 0; i < 3; i++ {
		genre := input.Genres[rand.Intn(len(input.Genres))]
		mood := input.Moods[rand.Intn(len(input.Moods))]

		uris, err := s.searchSpotifyTrack(input.SpotifyToken, input.ActivityType, genre, mood)
		if err != nil {
			return CreateSessionOutput{}, err
		}

		allURIs = append(allURIs, uris...)
	}

	return CreateSessionOutput{
		Session:   session,
		TrackURIs: allURIs,
	}, nil
}

// searchSpotifyTrack construye la query con deporte + género + mood y llama a la Spotify Search API.
// Devuelve hasta 3 URIs por búsqueda.
func (s *EngineService) searchSpotifyTrack(token, activityType, genre, mood string) ([]string, error) {
	// Query: "running pop happy" → Spotify busca tracks que coincidan con estos términos
	query := fmt.Sprintf("%s %s %s", activityType, genre, mood)

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

