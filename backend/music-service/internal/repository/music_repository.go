package repository

import (
	"time"

	"github.com/adrianyebid/fitbeat/music-service/internal/model"
)

// EngineRepository define las operaciones de acceso a datos del motor de música.
type EngineRepository interface {
	SaveSession(session model.TrainingSession) error
	GetSession(id string) (model.TrainingSession, error)
	UpdateSessionFinished(id string, finishedAt time.Time) (model.TrainingSession, error)
}
