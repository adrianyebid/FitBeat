package events

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

// Envelope define el contrato base de eventos entre microservicios.
type Envelope struct {
	EventID    string `json:"event_id"`
	EventType  string `json:"event_type"`
	OccurredAt string `json:"occurred_at"`
	Source     string `json:"source"`
	Version    int    `json:"version"`
	Payload    any    `json:"payload"`
}

func NewEnvelope(eventType, source string, payload any) Envelope {
	return Envelope{
		EventID:    newEventID(),
		EventType:  eventType,
		OccurredAt: time.Now().UTC().Format(time.RFC3339),
		Source:     source,
		Version:    1,
		Payload:    payload,
	}
}

func newEventID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(buf)
}
