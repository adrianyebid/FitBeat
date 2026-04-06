package model

import "time"

// TrainingSession representa una sesión de entrenamiento activa o histórica.
type TrainingSession struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	ActivityType string    `json:"activity_type"`
	Mode         string    `json:"mode"`
	CreatedAt    time.Time `json:"created_at"`
}
