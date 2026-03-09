package repository

import (
	"errors"
	"sync"

	"github.com/adrianyebid/fitbeat/music-service/internal/model"
)

var ErrSessionNotFound = errors.New("session not found")

// InMemoryRepository implementa EngineRepository usando almacenamiento en memoria.
type InMemoryRepository struct {
	mu         sync.RWMutex
	sessions   map[string]model.TrainingSession
	biometrics []model.BiometricData
	decisions  []model.TrackDecision
}

func NewInMemoryRepository() *InMemoryRepository {
	return &InMemoryRepository{
		sessions:   make(map[string]model.TrainingSession),
		biometrics: make([]model.BiometricData, 0),
		decisions:  make([]model.TrackDecision, 0),
	}
}

func (r *InMemoryRepository) SaveSession(session model.TrainingSession) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.sessions[session.ID] = session
	return nil
}

func (r *InMemoryRepository) FindSessionByID(id string) (*model.TrainingSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	session, ok := r.sessions[id]
	if !ok {
		return nil, ErrSessionNotFound
	}

	copy := session
	return &copy, nil
}

func (r *InMemoryRepository) SaveBiometric(data model.BiometricData) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.biometrics = append(r.biometrics, data)
	return nil
}

func (r *InMemoryRepository) SaveDecision(decision model.TrackDecision) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.decisions = append(r.decisions, decision)
	return nil
}
