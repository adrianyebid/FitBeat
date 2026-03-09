package main

import (
	"log"

	"github.com/adrianyebid/fitbeat/music-service/config"
	"github.com/adrianyebid/fitbeat/music-service/internal/handler"
	"github.com/adrianyebid/fitbeat/music-service/internal/repository"
	"github.com/adrianyebid/fitbeat/music-service/internal/service"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	r := gin.Default()
	engineRepository := repository.NewInMemoryRepository()
	engineService := service.NewEngineService(engineRepository)

	handler.RegisterRoutes(r, engineService)

	log.Printf("Music Service running on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
