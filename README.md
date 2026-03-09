# FitBeat

FitBeat es una plataforma fitness con frontend en React y backend orientado a microservicios.

Hoy el proyecto incluye:

- Frontend web con flujo de autenticacion, encuesta musical y entrenamiento.
- Componente B (`music-service`) en Go/Gin para sesiones de entrenamiento y decision musical por BPM.

## Arquitectura actual

```text
FitBeat/
|-- frontend/                 # React + Vite (UI y flujo de usuario)
|-- backend/
|   `-- music-service/        # Componente B: Music & Biometric Engine (Go + Gin)
`-- README.md
```

## Componente B: Music & Biometric Engine

Servicio en Go que actualmente permite:

1. Crear sesiones de entrenamiento.
2. Recibir datos biometricos (`heart_rate`).
3. Calcular intensidad por reglas de BPM.
4. Recomendar un track mock en memoria.
5. Guardar sesiones, biometria y decisiones en repository in-memory.

Endpoints actuales:

- `GET /api/v1/health`
- `POST /api/v1/sessions`
- `POST /api/v1/biometrics`

## Frontend

El frontend implementa:

- Login/registro.
- Encuesta de preferencias musicales.
- Flujo de entrenamiento (manual/smartwatch).
- Integracion con `music-service` para crear sesion y enviar BPM mock durante reproduccion.

## Ejecucion local rapida

### 1) Backend (Componente B)

```bash
cd backend/music-service
go run cmd/main.go
```

Por defecto corre en `http://localhost:8081`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Variables utiles en frontend:

- `VITE_API_BASE_URL` (auth backend actual del frontend)
- `VITE_MUSIC_ENGINE_BASE_URL` (default recomendado: `http://localhost:8081`)

## Estado de iteracion

Incluido:

- Flujo base end-to-end: crear sesion -> enviar BPM -> recibir recomendacion.
- Persistencia temporal en memoria.

Pendiente (futuras iteraciones):

- Integracion Spotify real.
- SSE/eventos en tiempo real.
- Persistencia NoSQL/SQL real.
- Integracion completa con Componente A.
- Autenticacion y autorizacion en Componente B.
