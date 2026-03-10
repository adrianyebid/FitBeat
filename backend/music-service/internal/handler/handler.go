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
	playerHandler := NewPlayerHandler()
	{
		v1.GET("/health", HealthCheck)
		v1.POST("/sessions", trainingHandler.CreateSession)
		v1.POST("/biometrics", trainingHandler.ProcessBiometric)

		player := v1.Group("/player")
		{
			player.PUT("/play", playerHandler.Play)
			player.PUT("/pause", playerHandler.Pause)
			player.POST("/next", playerHandler.Next)
			player.POST("/previous", playerHandler.Previous)
		}
	}
}

// HealthCheck verifica que el servicio está activo.
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "music-biometric-engine",
	})
}
