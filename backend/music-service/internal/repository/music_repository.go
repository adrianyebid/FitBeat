package repository

import "github.com/adrianyebid/fitbeat/music-service/internal/model"

// EngineRepository define las operaciones de acceso a datos del motor de música.
type EngineRepository interface {
	SaveSession(session model.TrainingSession) error
}
