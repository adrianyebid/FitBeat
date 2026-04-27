package config

import "os"

// Config contiene la configuración del servicio
type Config struct {
	Port        string
	CouchDBAddr string // user:pass@host:port (HTTP REST API de CouchDB)
	Events      EventsConfig
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

	return &Config{
		Port:        port,
		CouchDBAddr: couchAddr,
		Events: EventsConfig{
			Enabled:      eventsEnabled,
			RabbitURL:    rabbitURL,
			ExchangeName: exchangeName,
			Source:       source,
		},
	}
}
