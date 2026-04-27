package main

import (
	"log"
	"time"

	"github.com/adrianyebid/fitbeat/music-service/config"
	"github.com/adrianyebid/fitbeat/music-service/internal/events"
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
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{"GET", "POST", "PUT", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
		MaxAge:       12 * time.Hour,
	}))
	engineRepository, err := repository.NewCouchDBRepository(cfg.CouchDBAddr)
	if err != nil {
		log.Fatalf("Failed to connect to CouchDB: %v", err)
	}

	var publisher events.Publisher = events.NewNoopPublisher()
	if cfg.Events.Enabled {
		rabbitPublisher, err := connectRabbitWithRetry(
			cfg.Events.RabbitURL,
			cfg.Events.ExchangeName,
			cfg.Events.Source,
		)
		if err != nil {
			log.Fatalf("Failed to connect to RabbitMQ: %v", err)
		}
		publisher = rabbitPublisher
	}
	defer publisher.Close()

	engineService := service.NewEngineService(engineRepository, publisher, cfg.Events.Source)

	handler.RegisterRoutes(r, engineService)

	log.Printf("Music Service running on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func connectRabbitWithRetry(rabbitURL, exchangeName, source string) (*events.RabbitPublisher, error) {
	var lastErr error
	for attempt := 1; attempt <= 20; attempt++ {
		publisher, err := events.NewRabbitPublisher(rabbitURL, exchangeName, source)
		if err == nil {
			return publisher, nil
		}

		lastErr = err
		log.Printf("RabbitMQ connection attempt %d/20 failed: %v", attempt, err)
		time.Sleep(2 * time.Second)
	}

	return nil, lastErr
}
