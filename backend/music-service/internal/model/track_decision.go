package model

import "time"

// TrackDecision representa el resultado del motor para una lectura de BPM.
type TrackDecision struct {
	ID             string    `json:"id"`
	SessionID      string    `json:"session_id"`
	HeartRate      int       `json:"heart_rate"`
	IntensityLevel string    `json:"intensity_level"`
	Track          Track     `json:"track"`
	DecidedAt      time.Time `json:"decided_at"`
}
