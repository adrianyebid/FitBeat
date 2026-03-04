package service

import "github.com/adrianyebid/fitbeat/music-service/internal/model"

// FetchTracks contiene la lógica de negocio para obtener canciones
func FetchTracks() []model.Track {
	// TODO: conectar con repositorio / Spotify API / base de datos
	return []model.Track{
		{ID: "1", Title: "Example Track", Artist: "Example Artist", Duration: 210},
	}
}
