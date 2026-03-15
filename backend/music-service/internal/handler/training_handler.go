package handler

import (
	"log"
	"net/http"
	"strings"

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
	Genres     []string `json:"genres"`     // géneros musicales preferidos del usuario
	Categories []string `json:"categories"` // categorías preferidas del usuario
	SpotifyToken string   `json:"spotify_token"` // access token de Spotify del usuario
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
	})
	if err != nil {
		log.Printf("[CreateSession] error: %v", err)
		c.JSON(http.StatusInternalServerError, errorResponse("failed to create session", nil))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": gin.H{
			"session_id": output.Session.ID,
			"message":    "session created and tracks queued",
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
