package events

// NoopPublisher evita romper flujos locales cuando eventos está desactivado.
type NoopPublisher struct{}

func NewNoopPublisher() *NoopPublisher {
	return &NoopPublisher{}
}

func (p *NoopPublisher) Publish(_ string, _ any) error {
	return nil
}

func (p *NoopPublisher) Close() error {
	return nil
}
