package repository

import "github.com/adrianyebid/fitbeat/music-service/internal/model"

// MusicRepository define las operaciones de acceso a datos
type MusicRepository interface {
	FindAll() ([]model.Track, error)
	FindByID(id string) (*model.Track, error)
}
