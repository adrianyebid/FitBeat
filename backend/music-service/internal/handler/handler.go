package handler

import (
	"net/http"

	"github.com/adrianyebid/fitbeat/music-service/internal/service"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registra todas las rutas del microservicio.
func RegisterRoutes(r *gin.Engine, engineService *service.EngineService) {
	v1 := r.Group("/api/v1")
	trainingHandler := NewTrainingHandler(engineService)
	wsHandler := NewWSHandler()
	{
		v1.GET("/health", HealthCheck)
		v1.POST("/sessions", trainingHandler.CreateSession)

		// WebSocket — canal persistente para el control del reproductor durante la sesión.
		// Conexión: ws://localhost:8081/api/v1/ws?token=<spotify_token>
		v1.GET("/ws", wsHandler.HandleSession)
	}
}

// HealthCheck verifica que el servicio está activo.
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "music-service",
	})
}
