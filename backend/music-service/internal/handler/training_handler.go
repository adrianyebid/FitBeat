package handler

import (
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/adrianyebid/fitbeat/music-service/internal/service"
	"github.com/gin-gonic/gin"
)

// TrainingHandler gestiona los endpoints del ciclo de vida del entrenamiento:
// crear sesión y procesar lecturas biométricas.
type TrainingHandler struct {
	engineService *service.EngineService
}

// createSessionRequest define los campos requeridos para iniciar una sesión de entrenamiento.
type createSessionRequest struct {
	UserID       string   `json:"user_id"`
	ActivityType string   `json:"activity_type"` // ej: "running", "cycling"
	Mode         string   `json:"mode"`          // ej: "automatic", "manual"
	Genres       []string `json:"genres"`        // géneros musicales preferidos del usuario
	Categories   []string `json:"categories"`    // categorías preferidas del usuario
	SpotifyToken string   `json:"spotify_token"` // access token de Spotify del usuario
	DeviceID     string   `json:"device_id"`     // device id para Web Playback
}

type finishSessionRequest struct {
	EndedAt string `json:"ended_at"`
}

func NewTrainingHandler(engineService *service.EngineService) *TrainingHandler {
	return &TrainingHandler{engineService: engineService}
}

// CreateSession inicia una nueva sesión de entrenamiento para el usuario.
// Valida todos los campos requeridos antes de delegar al service.
// Devuelve 201 con la sesión creada, incluyendo su ID para usarlo en el flujo actual
// (por ejemplo, mediante el WS /api/v1/ws o el nuevo contrato de sesión).
func (h *TrainingHandler) CreateSession(c *gin.Context) {
	var req createSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid JSON payload", nil))
		return
	}

	// Acumular todos los errores de validación en un solo response en lugar de fallar en el primero
	details := make([]string, 0)
	if strings.TrimSpace(req.UserID) == "" {
		details = append(details, "user_id is required")
	}
	if strings.TrimSpace(req.ActivityType) == "" {
		details = append(details, "activity_type is required")
	}
	if strings.TrimSpace(req.Mode) == "" {
		details = append(details, "mode is required")
	}
	if len(req.Genres) == 0 {
		details = append(details, "genres is required and must not be empty")
	}
	if len(req.Categories) == 0 {
		details = append(details, "categories is required and must not be empty")
	}
	if strings.TrimSpace(req.SpotifyToken) == "" {
		details = append(details, "spotify_token is required")
	}

	if len(details) > 0 {
		c.JSON(http.StatusBadRequest, errorResponse("validation failed", details))
		return
	}

	output, err := h.engineService.CreateSession(service.CreateSessionInput{
		UserID:       req.UserID,
		ActivityType: req.ActivityType,
		Mode:         req.Mode,
		Genres:       req.Genres,
		Categories:   req.Categories,
		SpotifyToken: req.SpotifyToken,
		DeviceID:     req.DeviceID,
	})
	if err != nil {
		log.Printf("[CreateSession] error: %v", err)
		errMsg := err.Error()
		switch {
		case strings.Contains(errMsg, "spotify queue returned 404"):
			c.JSON(
				http.StatusConflict,
				errorResponse(
					"no active Spotify device",
					[]string{"Abre Spotify y reproduce una canción antes de iniciar el entrenamiento."},
				),
			)
			return
		case strings.Contains(errMsg, "spotify search returned 429"),
			strings.Contains(errMsg, "spotify queue returned 429"):
			c.JSON(
				http.StatusTooManyRequests,
				errorResponse(
					"spotify rate limit",
					[]string{"Espera unos segundos y vuelve a intentar."},
				),
			)
			return
		default:
			c.JSON(http.StatusInternalServerError, errorResponse("failed to create session", []string{errMsg}))
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": gin.H{
			"session_id": output.Session.ID,
			"message":    "session created and tracks queued",
		},
	})
}

// GetSession devuelve los datos de una sesión de entrenamiento almacenada en CouchDB.
func (h *TrainingHandler) GetSession(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, errorResponse("session id is required", nil))
		return
	}

	session, err := h.engineService.GetSession(id)
	if err != nil {
		if err.Error() == "session not found" {
			c.JSON(http.StatusNotFound, errorResponse("session not found", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("failed to retrieve session", nil))
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}

// FinishSession marca la sesión como finalizada y publica un evento session.finished.
func (h *TrainingHandler) FinishSession(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, errorResponse("session id is required", nil))
		return
	}

	var req finishSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, errorResponse("invalid JSON payload", nil))
		return
	}

	finishedAt := time.Now().UTC()
	if strings.TrimSpace(req.EndedAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(req.EndedAt))
		if err != nil {
			c.JSON(http.StatusBadRequest, errorResponse("ended_at must be RFC3339", []string{"example: 2026-04-27T15:04:05Z"}))
			return
		}
		finishedAt = parsed.UTC()
	}

	session, err := h.engineService.FinishSession(id, finishedAt)
	if err != nil {
		switch err.Error() {
		case "session not found":
			c.JSON(http.StatusNotFound, errorResponse("session not found", nil))
		default:
			c.JSON(http.StatusInternalServerError, errorResponse("failed to finish session", []string{err.Error()}))
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"session_id":  session.ID,
			"finished_at": session.FinishedAt,
			"message":     "session finished",
		},
	})
}

// errorResponse construye el formato de error estándar de la API.
func errorResponse(message string, details []string) gin.H {
	return gin.H{
		"message": message,
		"details": detailsOrEmpty(details),
	}
}

// detailsOrEmpty garantiza que el campo details siempre sea un array en el JSON de respuesta,
// nunca null — esto simplifica el manejo de errores en el frontend.
func detailsOrEmpty(details []string) []string {
	if len(details) == 0 {
		return []string{}
	}
	return details
}
