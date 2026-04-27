package events

// Publisher define las operaciones para publicar eventos de dominio.
type Publisher interface {
	Publish(eventType string, payload any) error
	Close() error
}
