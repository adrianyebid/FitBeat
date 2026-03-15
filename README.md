# FitBeat

Plataforma fitness con arquitectura por componentes:

1. Frontend en React + Vite
2. Componente A en FastAPI (auth local JWT + Spotify OAuth + token provider)
3. Componente B en Go (music-service: sesiones + control de reproductor por WebSocket)

Fecha de referencia de este estado: **2026-03-15**.

## Estado actual del proyecto

### Frontend (`frontend/`)

Implementado:
- Login y registro contra `POST /api/auth/login` y `POST /api/auth/register`.
- Persistencia real de sesion: `user`, `accessToken`, `refreshToken` en localStorage.
- Envio automatico de `Authorization: Bearer <accessToken>` a Componente A.
- Flujo visible de Spotify desde dashboard:
  - Boton `Conectar Spotify`
  - Verificacion de estado por `GET /auth/verify-connection/{user_id}`
  - Retorno de callback a dashboard con estado de conexion
- Encuesta musical guardada en `musicPreferences` y mapeada a:
  - `genres[]`
  - `categories[]`
- Inicio de entrenamiento con contrato actual de Componente B:
  - `POST /api/v1/sessions`
  - payload: `user_id`, `activity_type`, `mode`, `genres`, `categories`, `spotify_token`
- Control de reproductor por WebSocket:
  - `play`, `pause`, `next`, `previous`
  - Manejo de `token_expired -> refresh token -> update_token -> retry accion`

Pendiente:
- Agregar tests E2E del flujo completo (auth + spotify + entrenamiento + ws).
- Mejorar UX cuando la sesion JWT expira durante navegacion normal (mensajes globales y redireccion).

### Componente A (`src/`)

Implementado:
- Auth local JWT:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `GET /api/auth/me`
- Rotacion y revocacion de refresh token:
  - tabla `refresh_token_sessions`
  - cada refresh invalida el token anterior y emite uno nuevo
- OAuth Spotify:
  - `GET /auth/login/{user_id}`
  - `GET /auth/callback`
  - `GET /auth/verify-connection/{user_id}`
- Token provider interno:
  - `GET /auth/internal/token/{user_id}`
  - protegido con JWT del usuario (sub debe coincidir con `user_id`) o `X-Internal-Token`
- CORS habilitado para `http://localhost:5173` y `FRONTEND_APP_URL`.
- Persistencia actual en PostgreSQL:
  - `users`
  - `spotify_tokens`
  - `local_auth_credentials`
  - `refresh_token_sessions`

Pendiente:
- Migraciones formales de base de datos (Alembic) en lugar de depender de `create_all`.
- Endpoints de gestion de sesiones (`logout`, `logout-all`, revocacion manual).
- Hardening extra: rate limiting en login/refresh, auditoria de eventos de auth.

### Componente B (`backend/music-service/`)

Implementado:
- `GET /api/v1/health`
- `POST /api/v1/sessions`
- `GET /api/v1/ws?token=...`
- Busqueda/enqueue de tracks en paralelo y persistencia de sesiones en CouchDB.

Pendiente:
- Autenticacion/autorizacion de servicio para sus endpoints.
- Observabilidad (metricas, trazas, logs estructurados de acciones WS).
- Contrato formal versionado entre componentes.

## Flujo end-to-end actual

1. Usuario hace login/registro en frontend (Componente A).
2. Frontend guarda JWT (access + refresh) y mantiene sesion.
3. Usuario completa encuesta musical.
4. Desde dashboard, usuario conecta Spotify (`/auth/login/{user_id}`).
5. Spotify redirige a `/auth/callback`; Componente A guarda tokens Spotify y devuelve al dashboard.
6. Usuario inicia entrenamiento:
   - frontend solicita token Spotify valido a `/auth/internal/token/{user_id}` (autenticado con JWT)
   - frontend crea sesion en Componente B con payload completo
7. Frontend abre WebSocket contra Componente B y controla reproduccion.
8. Si Componente B responde `token_expired`, frontend refresca token Spotify y reintenta accion.

## Variables de entorno

### Raiz (`.env`) - Componente A

Ver plantilla en [`.env.example`](c:/FitBeat/.env.example).

Variables clave:
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `FRONTEND_APP_URL`
- `INTERNAL_SERVICE_TOKEN` (opcional, para trafico service-to-service)
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `REDIRECT_URI`

### Frontend (`frontend/.env`)

Ver plantilla en [`frontend/.env.example`](c:/FitBeat/frontend/.env.example).

```env
VITE_AUTH_API_URL=http://localhost:8000
VITE_MUSIC_API_URL=http://localhost:8081
VITE_WS_API_URL=ws://localhost:8081
```

## Ejecucion local rapida

### 1) Componente A (FastAPI + Postgres)

En la raiz del repo:

```bash
docker-compose up --build
```

API disponible en `http://localhost:8000`.

### 2) Componente B (Go music-service)

```bash
cd backend/music-service
go run cmd/main.go
```

Servicio disponible en `http://localhost:8081`.

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

App en `http://localhost:5173`.

## Notas

- Existe `backend/target/...` con artefactos Java antiguos; no forma parte del backend activo actual.
- El endpoint `/auth/internal/token/{user_id}` ya no debe usarse sin autenticacion valida.
