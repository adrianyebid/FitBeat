package events

import (
	"encoding/json"
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"
)

// RabbitPublisher publica eventos a RabbitMQ usando un exchange topic.
type RabbitPublisher struct {
	conn         *amqp.Connection
	ch           *amqp.Channel
	exchangeName string
	source       string
}

func NewRabbitPublisher(rabbitURL, exchangeName, source string) (*RabbitPublisher, error) {
	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		return nil, fmt.Errorf("rabbitmq dial: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("rabbitmq channel: %w", err)
	}

	if err := ch.ExchangeDeclare(
		exchangeName,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		ch.Close()
		conn.Close()
		return nil, fmt.Errorf("declare exchange: %w", err)
	}

	return &RabbitPublisher{
		conn:         conn,
		ch:           ch,
		exchangeName: exchangeName,
		source:       source,
	}, nil
}

func (p *RabbitPublisher) Publish(eventType string, payload any) error {
	envelope := NewEnvelope(eventType, p.source, payload)

	body, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	if err := p.ch.Publish(
		p.exchangeName,
		eventType,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
		},
	); err != nil {
		return fmt.Errorf("publish event: %w", err)
	}

	return nil
}

func (p *RabbitPublisher) Close() error {
	if p.ch != nil {
		_ = p.ch.Close()
	}
	if p.conn != nil {
		return p.conn.Close()
	}
	return nil
}
