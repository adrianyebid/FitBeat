package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/adrianyebid/fitbeat/music-service/internal/service"
	"github.com/gin-gonic/gin"
)

type TrainingHandler struct {
	engineService *service.EngineService
}

type createSessionRequest struct {
	UserID       string `json:"user_id"`
	ActivityType string `json:"activity_type"`
	Mode         string `json:"mode"`
}

type processBiometricRequest struct {
	SessionID string `json:"session_id"`
	HeartRate int    `json:"heart_rate"`
}

func NewTrainingHandler(engineService *service.EngineService) *TrainingHandler {
	return &TrainingHandler{engineService: engineService}
}

func (h *TrainingHandler) CreateSession(c *gin.Context) {
	var req createSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid JSON payload", nil))
		return
	}

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
		if errors.Is(err, service.ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, errorResponse("session not found", []string{"session_id does not exist"}))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("failed to process biometric data", nil))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": decision})
}

func errorResponse(message string, details []string) gin.H {
	return gin.H{
		"message": message,
		"details": detailsOrEmpty(details),
	}
}

func detailsOrEmpty(details []string) []string {
	if len(details) == 0 {
		return []string{}
	}
	return details
}
