package handler

import (
	"net/http"

	"github.com/adrianyebid/fitbeat/music-service/internal/service"
	"github.com/gin-gonic/gin"
)

// GetTracks devuelve la lista de canciones (placeholder)
func GetTracks(c *gin.Context) {
	tracks := service.FetchTracks()
	c.JSON(http.StatusOK, gin.H{
		"data": tracks,
	})
}
