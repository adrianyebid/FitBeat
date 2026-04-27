# Event Processor (Componente 1)

Microservicio asíncrono en Java que:

- consume `session.started`, `track.skipped`, `session.finished` desde RabbitMQ
- calcula métricas derivadas por sesión y por semana
- persiste resultados en PostgreSQL propio
- publica eventos de negocio: `weekly_goal_reached`, `first_10_sessions`

## Variables principales

- `EVENT_DB_URL`, `EVENT_DB_USER`, `EVENT_DB_PASSWORD`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASS`
- `RABBITMQ_EVENTS_EXCHANGE`
- `EVENT_QUEUE_NAME`, `EVENT_DLQ_NAME`
- `WEEKLY_SESSIONS_GOAL`

## Ejecución local

```bash
docker compose up --build
```
