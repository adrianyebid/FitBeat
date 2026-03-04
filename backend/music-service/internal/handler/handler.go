package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes registra todas las rutas del microservicio
func RegisterRoutes(r *gin.Engine) {
	v1 := r.Group("/api/v1")
	{
		v1.GET("/music/health", HealthCheck)
		v1.GET("/music/tracks", GetTracks)
	}
}

// HealthCheck verifica que el servicio está activo
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "music-service",
	})
}
