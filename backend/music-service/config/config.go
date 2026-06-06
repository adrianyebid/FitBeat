package config

import (
	"os"
	"strconv"
	"time"
)

// Config contiene la configuración del servicio
type Config struct {
	Port           string
	CouchDBAddr    string // user:pass@host:port (HTTP REST API de CouchDB)
	InternalSecret string // FITBEAT_INTERNAL_SECRET for S2S auth
	SpotifyTimeout time.Duration
	Events         EventsConfig
}

type EventsConfig struct {
	Enabled      bool
	RabbitURL    string
	ExchangeName string
	Source       string
}

// Load carga la configuración desde variables de entorno con valores por defecto
func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	couchAddr := os.Getenv("COUCHDB_ADDR")
	if couchAddr == "" {
		couchAddr = "admin:secret@localhost:5984"
	}

	eventsEnabled := os.Getenv("EVENTS_ENABLED") == "true"

	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		rabbitURL = "amqp://guest:guest@localhost:5672/"
	}

	exchangeName := os.Getenv("RABBITMQ_EVENTS_EXCHANGE")
	if exchangeName == "" {
		exchangeName = "fitbeat.events"
	}

	source := os.Getenv("EVENT_SOURCE")
	if source == "" {
		source = "music-service"
	}

	spotifyTimeoutSeconds := 3
	if raw := os.Getenv("SPOTIFY_HTTP_TIMEOUT_SECONDS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			spotifyTimeoutSeconds = parsed
		}
	}

	return &Config{
		Port:           port,
		CouchDBAddr:    couchAddr,
		InternalSecret: os.Getenv("FITBEAT_INTERNAL_SECRET"),
		SpotifyTimeout: time.Duration(spotifyTimeoutSeconds) * time.Second,
		Events: EventsConfig{
			Enabled:      eventsEnabled,
			RabbitURL:    rabbitURL,
			ExchangeName: exchangeName,
			Source:       source,
		},
	}
}
