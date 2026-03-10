package handler

import (
	"errors"
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
	UserID       string `json:"user_id"`
	ActivityType string `json:"activity_type"` // ej: "running", "cycling"
	Mode         string `json:"mode"`          // ej: "automatic", "manual"
}

// processBiometricRequest define los datos de una lectura biométrica enviada durante el entrenamiento.
type processBiometricRequest struct {
	SessionID string `json:"session_id"` // ID de la sesión activa
	HeartRate int    `json:"heart_rate"` // BPM reportados por el dispositivo del usuario
}

func NewTrainingHandler(engineService *service.EngineService) *TrainingHandler {
	return &TrainingHandler{engineService: engineService}
}

// CreateSession inicia una nueva sesión de entrenamiento para el usuario.
// Valida todos los campos requeridos antes de delegar al service.
// Devuelve 201 con la sesión creada, incluyendo su ID para usarlo en /biometrics.
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

	if len(details) > 0 {
		c.JSON(http.StatusBadRequest, errorResponse("validation failed", details))
		return
	}

	session, err := h.engineService.CreateSession(service.CreateSessionInput{
		UserID:       req.UserID,
		ActivityType: req.ActivityType,
		Mode:         req.Mode,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("failed to create session", nil))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": session})
}

// ProcessBiometric recibe una lectura de frecuencia cardíaca y devuelve la canción recomendada.
// El motor evalúa el BPM, determina la intensidad del ejercicio y selecciona el track más adecuado.
// Devuelve 200 con un TrackDecision que contiene el track y el nivel de intensidad calculado.
func (h *TrainingHandler) ProcessBiometric(c *gin.Context) {
	var req processBiometricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid JSON payload", nil))
		return
	}

	details := make([]string, 0)
	if strings.TrimSpace(req.SessionID) == "" {
		details = append(details, "session_id is required")
	}
	// Un heart_rate de 0 o negativo no es fisiológicamente válido
	if req.HeartRate <= 0 {
		details = append(details, "heart_rate must be greater than 0")
	}

	if len(details) > 0 {
		c.JSON(http.StatusBadRequest, errorResponse("validation failed", details))
		return
	}

	decision, err := h.engineService.ProcessBiometric(service.ProcessBiometricInput{
		SessionID: req.SessionID,
		HeartRate: req.HeartRate,
	})
	if err != nil {
		// Diferenciar sesión no encontrada (404) de errores internos (500)
		if errors.Is(err, service.ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, errorResponse("session not found", []string{"session_id does not exist"}))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("failed to process biometric data", nil))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": decision})
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
