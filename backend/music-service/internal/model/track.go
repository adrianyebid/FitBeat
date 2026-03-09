package model

// Track representa una canción en el sistema
type Track struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Duration  int    `json:"duration"` // en segundos
	Intensity string `json:"intensity"`
}
