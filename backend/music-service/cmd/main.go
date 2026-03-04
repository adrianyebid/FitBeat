package main

import (
	"log"

	"github.com/adrianyebid/fitbeat/music-service/config"
	"github.com/adrianyebid/fitbeat/music-service/internal/handler"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	r := gin.Default()

	handler.RegisterRoutes(r)

	log.Printf("Music Service running on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
