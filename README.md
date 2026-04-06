# FitBeat

Plataforma fitness con arquitectura por componentes:

1. Frontend en React + Vite
2. Componente A en FastAPI (auth local JWT + Spotify OAuth + token provider)
3. Componente B en Go (music-service: sesiones + control de reproductor por WebSocket)

## Estado actual del proyecto

### Frontend (`frontend/`)

Implementado:
- Login y registro contra `POST /api/auth/login` y `POST /api/auth/register`.
- Persistencia de sesion: `user`, `accessToken`, `refreshToken` en localStorage.
- Envio automatico de `Authorization: Bearer <accessToken>` a Componente A.
- Flujo Spotify desde dashboard:
  - Boton `Conectar Spotify`
  - Verificacion de estado por `GET /auth/verify-connection/{user_id}`
  - Now Playing por `GET /auth/now-playing/{user_id}`
  - Retorno de callback a dashboard con estado de conexion
- Encuesta musical guardada en `musicPreferences` y mapeada a `genres[]` y `categories[]`.
- Inicio de entrenamiento con contrato de Componente B:
  - `POST /api/v1/sessions`
  - payload: `user_id`, `activity_type`, `mode`, `genres`, `categories`, `spotify_token`, `device_id`
- Control de reproductor por WebSocket: `play`, `pause`, `next`, `previous`
  - Manejo de `token_expired -> refresh token -> update_token -> retry accion`

Pendiente:
- Tests E2E del flujo completo (auth + spotify + entrenamiento + ws).
- Mejorar UX cuando la sesion JWT expira durante navegacion normal.

### Componente A (`backend/user-service/`)

Implementado:
- Auth local JWT:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `GET /api/auth/me`
- Rotacion y revocacion de refresh token (tabla `refresh_token_sessions`).
- OAuth Spotify:
  - `GET /auth/login/{user_id}`
  - `GET /auth/callback`
  - `GET /auth/verify-connection/{user_id}`
  - `GET /auth/now-playing/{user_id}`
- Token provider interno: `GET /auth/internal/token/{user_id}`
- CORS habilitado para `http://localhost:5173` y `FRONTEND_APP_URL`.
- Persistencia en PostgreSQL: `users`, `spotify_tokens`, `local_auth_credentials`, `refresh_token_sessions`.

### Componente B (`backend/music-service/`)

Implementado:
- `GET /api/v1/health`
- `POST /api/v1/sessions`
- `GET /api/v1/ws?token=...`
- Busqueda/enqueue de tracks en paralelo y persistencia de sesiones en CouchDB.

Pendiente:
- Autenticacion/autorizacion de servicio para sus endpoints.
- Observabilidad (metricas, trazas, logs estructurados).

## Flujo end-to-end actual

1. Usuario hace login/registro en frontend (Componente A).
2. Frontend guarda JWT (access + refresh) y mantiene sesion.
3. Usuario completa encuesta musical.
4. Desde dashboard, usuario conecta Spotify (`/auth/login/{user_id}`).
5. Spotify redirige a `/auth/callback`; Componente A guarda tokens y devuelve al dashboard.
6. Usuario inicia entrenamiento:
   - Frontend solicita token Spotify a `/auth/internal/token/{user_id}` (autenticado con JWT).
   - Frontend crea sesion en Componente B con payload completo.
7. Frontend abre WebSocket contra Componente B y controla reproduccion.
8. Si Componente B responde `token_expired`, frontend refresca token Spotify y reintenta.

## Variables de entorno

### Raiz (`.env`)

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=component_a

SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
REDIRECT_URI=http://127.0.0.1:8000/auth/callback

JWT_SECRET_KEY=
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
FRONTEND_APP_URL=http://localhost:5173
INTERNAL_SERVICE_TOKEN=
ENCRYPTION_KEY=

COUCHDB_USER=admin
COUCHDB_PASSWORD=secret
```

### Frontend (`frontend/.env`)

```env
VITE_AUTH_API_URL=http://localhost:8000
VITE_MUSIC_API_URL=http://localhost:8081
VITE_WS_API_URL=ws://localhost:8081
```

## Ejecucion local

### Requisitos previos

- Docker Desktop
- Cuenta Spotify Developer con `REDIRECT_URI=http://127.0.0.1:8000/auth/callback` configurado en la app y usuario Premium para reproduccion.

```bash
docker-compose up --build
```

| Servicio | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| Componente A (FastAPI) | http://localhost:8000 |
| Componente B (Go) | http://localhost:8081 |
| PostgreSQL | localhost:5433 |
| CouchDB | http://localhost:5984 |

## Prueba del flujo completo

1. Abrir `http://localhost:5173`, registrarse o iniciar sesion.
2. Completar encuesta en `/music-survey`.
3. En `/dashboard`, pulsar `Conectar Spotify` y completar OAuth.
4. Abrir Spotify y reproducir una cancion para activar un dispositivo.
5. Pulsar `Comenzar entrenamiento` y recorrer `/training` → `/training/select-type` → `/training/play/:trainingType`.
6. Probar controles del reproductor: `previous`, `play/pause`, `next`.

### Rutas protegidas

Redirigen a `/` si no hay sesion valida: `/dashboard`, `/music-survey`, `/training`, `/training/select-type`, `/training/play/:trainingType`.

### Reset de sesion en navegador

Borrar del localStorage: `fitbeat-auth`, `fitbeat-user`, `musicPreferences`.
