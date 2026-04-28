# Achievements Service (.NET 8)

Microservicio de gamificación de FitBeat implementado con .NET 8 Minimal API.
Evalúa sesiones finalizadas y desbloquea logros (badges) por usuario.

## Base URL

- Local (Docker Compose): `http://localhost:8082`

## Endpoints

- `GET /health`
- `GET /achievements/catalog`
- `GET /achievements/user/{id}`
- `POST /achievements/evaluate`

## Modelo de logros (MVP)

- `first_workout_completed`: primer entrenamiento completado.
- `five_sessions_streak`: 5 días consecutivos con entrenamientos.
- `weekly_100_minutes`: 100 minutos acumulados en ventana de 7 días.

## Contrato API

### 1) Healthcheck

`GET /health`

Respuesta `200 OK`:

```json
{
  "status": "ok",
  "service": "achievements-service"
}
```

### 2) Catálogo de logros

`GET /achievements/catalog`

Respuesta `200 OK`:

```json
[
  {
    "code": "first_workout_completed",
    "name": "Primer entreno completado",
    "description": "Completa tu primera sesión de entrenamiento.",
    "targetValue": 1,
    "unit": "session"
  }
]
```

### 3) Progreso de usuario

`GET /achievements/user/{id}`

Respuesta `200 OK`:

```json
{
  "userId": "user-123",
  "progress": {
    "totalSessions": 7,
    "currentStreakDays": 3,
    "weeklyMinutes": 118
  },
  "unlockedAchievements": [
    {
      "achievementCode": "first_workout_completed",
      "unlockedAtUtc": "2026-04-23T16:40:00Z"
    }
  ]
}
```

Posible error `400 Bad Request`:

```json
{
  "message": "user id is required"
}
```

### 4) Evaluar sesión y desbloquear logros

`POST /achievements/evaluate`

Request body:

```json
{
  "userId": "user-123",
  "sessionId": "session-abc-001",
  "durationMinutes": 35,
  "completedAtUtc": "2026-04-23T15:30:00Z"
}
```

Campos:

- `userId` (string, requerido)
- `sessionId` (string, opcional; recomendado para idempotencia)
- `durationMinutes` (int, requerido, rango `1..1440`)
- `completedAtUtc` (ISO-8601 UTC, opcional; si no llega, usa `DateTime.UtcNow`)

Respuesta `200 OK`:

```json
{
  "userId": "user-123",
  "sessionId": "session-abc-001",
  "evaluatedAtUtc": "2026-04-23T15:30:00Z",
  "progress": {
    "totalSessions": 8,
    "currentStreakDays": 4,
    "weeklyMinutes": 153
  },
  "newlyUnlocked": [
    "weekly_100_minutes"
  ],
  "unlockedAchievements": [
    "first_workout_completed",
    "weekly_100_minutes"
  ],
  "message": null
}
```

Caso idempotente (misma sesión ya procesada):

```json
{
  "userId": "user-123",
  "sessionId": "session-abc-001",
  "evaluatedAtUtc": "2026-04-23T15:30:00Z",
  "progress": {
    "totalSessions": 8,
    "currentStreakDays": 4,
    "weeklyMinutes": 153
  },
  "newlyUnlocked": [],
  "unlockedAchievements": [
    "first_workout_completed",
    "weekly_100_minutes"
  ],
  "message": "session already processed"
}
```

Error de validación `400 Bad Request`:

```json
{
  "message": "invalid request payload",
  "details": [
    "UserId is required",
    "The field DurationMinutes must be between 1 and 1440."
  ]
}
```

## Ejemplos rápidos (curl)

Consultar catálogo:

```bash
curl -s http://localhost:8082/achievements/catalog
```

Evaluar una sesión:

```bash
curl -s -X POST http://localhost:8082/achievements/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user-123",
    "sessionId":"session-001",
    "durationMinutes":30,
    "completedAtUtc":"2026-04-23T15:30:00Z"
  }'
```

Consultar progreso:

```bash
curl -s http://localhost:8082/achievements/user/user-123
```

## Ejecutar con Docker Compose

Desde la raíz del repo:

```bash
docker compose up --build achievements_service
```

Para levantar todo el sistema:

```bash
docker compose up --build
```

## Notas de implementación

- Persistencia local con SQLite (`/app/Data/achievements.db`).
- Catálogo de logros se inicializa automáticamente al arrancar.
- Idempotencia por combinación `userId + sessionId`.
