package handler

import (
	"net/http"

	"github.com/adrianyebid/fitbeat/music-service/internal/service"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine, engineService *service.EngineService, internalSecret string) {
	v1 := r.Group("/api/v1")
	trainingHandler := NewTrainingHandler(engineService)
	wsHandler := NewWSHandler(engineService)

	// Public routes (consumed via KrakenD by the frontend)
	v1.GET("/health", HealthCheck)
	v1.POST("/sessions", trainingHandler.CreateSession)
	v1.GET("/sessions/:id", trainingHandler.GetSession)
	v1.POST("/sessions/:id/finish", trainingHandler.FinishSession)
	v1.GET("/ws", wsHandler.HandleSession)

	// Internal S2S routes — protected by shared secret middleware.
	// Ready for future internal endpoints; no public routes go here.
	_ = v1.Group("/internal", InternalSecretAuth(internalSecret))
}

func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "music-service",
	})
}
