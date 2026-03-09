package repository

import "github.com/adrianyebid/fitbeat/music-service/internal/model"

// EngineRepository define las operaciones de acceso a datos del motor de música y biométricos.
type EngineRepository interface {
	SaveSession(session model.TrainingSession) error
	FindSessionByID(id string) (*model.TrainingSession, error)
	SaveBiometric(data model.BiometricData) error
	SaveDecision(decision model.TrackDecision) error
}
