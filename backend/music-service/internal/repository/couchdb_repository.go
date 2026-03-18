package repository

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/adrianyebid/fitbeat/music-service/internal/model"
)

const dbName = "training_sessions"

// CouchDBRepository implementa EngineRepository usando CouchDB vía HTTP REST.
type CouchDBRepository struct {
	baseURL    string
	httpClient *http.Client
}

// NewCouchDBRepository crea el repositorio y garantiza que el bucket (database) exista.
// addr debe tener el formato "user:pass@host:port", por ejemplo "admin:secret@localhost:5984".
func NewCouchDBRepository(addr string) (*CouchDBRepository, error) {
	r := &CouchDBRepository{
		baseURL:    "http://" + addr,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	if err := r.ensureDB(); err != nil {
		return nil, fmt.Errorf("couchdb: ensure database: %w", err)
	}
	return r, nil
}

// ensureDB crea el database si no existe (412 = ya existe, también es OK).
func (r *CouchDBRepository) ensureDB() error {
	req, err := http.NewRequest(http.MethodPut, r.baseURL+"/"+dbName, nil)
	if err != nil {
		return err
	}
	resp, err := r.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 201 = creado, 412 = ya existía — ambos son OK
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusPreconditionFailed {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return nil
}

// SaveSession persiste una sesión de entrenamiento en CouchDB.
// El _id del documento CouchDB es el ID de la sesión.
func (r *CouchDBRepository) SaveSession(session model.TrainingSession) error {
	body, err := json.Marshal(session)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/%s/%s", r.baseURL, dbName, session.ID)
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 201 = creado, 202 = aceptado en modo asíncrono
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("couchdb: SaveSession returned status %d", resp.StatusCode)
	}
	return nil
}
