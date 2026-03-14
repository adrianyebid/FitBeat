package main

import (
	"log"
	"time"

	"github.com/adrianyebid/fitbeat/music-service/config"
	"github.com/adrianyebid/fitbeat/music-service/internal/handler"
	"github.com/adrianyebid/fitbeat/music-service/internal/repository"
	"github.com/adrianyebid/fitbeat/music-service/internal/service"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		MaxAge:           12 * time.Hour,
	}))
	engineRepository, err := repository.NewCouchDBRepository(cfg.CouchDBAddr)
	if err != nil {
		log.Fatalf("Failed to connect to CouchDB: %v", err)
	}
	engineService := service.NewEngineService(engineRepository)

	handler.RegisterRoutes(r, engineService)

	log.Printf("Music Service running on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
