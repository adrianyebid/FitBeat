package config

import "os"

// Config contiene la configuración del servicio
type Config struct {
	Port        string
	CouchDBAddr string // user:pass@host:port (HTTP REST API de CouchDB)
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

	return &Config{
		Port:        port,
		CouchDBAddr: couchAddr,
	}
}
