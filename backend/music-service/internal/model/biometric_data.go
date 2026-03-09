package model

import "time"

// BiometricData representa una lectura biométrica reportada por una sesión.
type BiometricData struct {
	ID        string    `json:"id"`
	SessionID string    `json:"session_id"`
	HeartRate int       `json:"heart_rate"`
	RecordedAt time.Time `json:"recorded_at"`
}
