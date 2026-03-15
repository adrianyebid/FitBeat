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
# Componente A — User Service & Spotify Auth

API REST construida con **FastAPI** para gestión de usuarios, autenticación OAuth con Spotify y servicio de tokens para el Componente B.

---

## Estructura del Repositorio

```
PROTOTIPO 1/
├── src/
│   ├── main.py                          # Punto de entrada de la aplicación
│   ├── core/
│   │   ├── config.py                    # Configuración (pydantic-settings + .env)
│   │   ├── database.py                  # Engine, SessionLocal, Base de SQLAlchemy
│   │   └── security.py                  # Funciones de cifrado (Fernet, fase futura)
│   ├── users/
│   │   ├── domain/
│   │   │   └── schemas.py               # Esquemas Pydantic (UserCreate, UserResponse)
│   │   ├── application/
│   │   │   └── services.py              # Lógica de negocio (create_user, get_user)
│   │   └── infrastructure/
│   │       ├── models.py                # Tabla 'users' (SQLAlchemy)
│   │       └── routers.py               # Endpoints REST (/users)
│   ├── auth/
│   │   ├── domain/                      # (Reservado para futuras entidades)
│   │   ├── application/
│   │   │   └── services.py              # OAuth flow, refresh, token provider
│   │   └── infrastructure/
│   │       ├── models.py                # Tabla 'spotify_tokens' (SQLAlchemy)
│   │       └── routers.py               # Endpoints REST (/auth)
│   └── preferences/
│       ├── domain/
│       │   └── models.py                # Enums: Genero, Mood, Sport
│       └── infrastructure/
│           └── schemas.py               # Esquema RegistroPreferencias
├── .env                                 # Variables de entorno (NO se sube a Git)
├── .env.example                         # Plantilla de variables (SÍ se sube)
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Requisitos Previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Git (para clonar el repositorio)

---

## Guía Paso a Paso

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd "PROTOTIPO 1"
```

### 2. Configurar las variables de entorno

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=component_a
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/component_a

# Spotify OAuth
SPOTIFY_CLIENT_ID=<tu_client_id>
SPOTIFY_CLIENT_SECRET=<tu_client_secret>
REDIRECT_URI=http://127.0.0.1:8000/auth/callback

# Encryption (CWE-312 — fase futura)
ENCRYPTION_KEY=<tu_clave_fernet>
```

> Reemplaza `<tu_client_id>`, `<tu_client_secret>` y `<tu_clave_fernet>` con tus credenciales reales.

### 3. Construir y levantar los contenedores

```bash
docker-compose up --build
```

Esto levanta dos servicios:

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| `postgres_db` | `5433` | Base de datos PostgreSQL 15 |
| `component_a` | `8000` | API FastAPI con hot-reload |

Espera a ver en la terminal:

```
component_a_api  | INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4. Verificar que la API está viva

Abre en el navegador:

```
http://127.0.0.1:8000/
```

Respuesta esperada:

```json
{"status": "¡El Componente A está funcionando!"}
```

### 5. Explorar la documentación Swagger

```
http://127.0.0.1:8000/docs
```

Desde ahí puedes probar todos los endpoints interactivamente.

---

## Endpoints Disponibles

### Users (`/users`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/users/` | Crear un usuario con preferencias |
| `GET` | `/users/{user_id}` | Obtener un usuario por ID |

### Auth — Spotify OAuth (`/auth`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/auth/login/{user_id}` | Redirige a Spotify para autorización |
| `GET` | `/auth/callback` | Callback de Spotify (intercambio de tokens) |
| `GET` | `/auth/verify-connection/{user_id}` | Verifica conexión con Spotify |
| `GET` | `/auth/internal/token/{user_id}` | Token Provider para Componente B |

---

## Flujo Completo de Prueba

```
1. POST /users/                         → Crear usuario
2. GET  /auth/login/{user_id}           → Autorizar con Spotify (abre navegador)
3.      (Spotify redirige a /callback)  → Tokens guardados automáticamente
4. GET  /auth/verify-connection/{id}    → Confirmar conexión exitosa
5. GET  /auth/internal/token/{id}       → Obtener token + preferencias (para Comp. B)
```

---

## Comandos Útiles

```bash
# Levantar contenedores (primer uso o tras cambios en Dockerfile)
docker-compose up --build

# Levantar en segundo plano
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f component_a

# Detener contenedores
docker-compose down

# Detener y eliminar volúmenes (BORRA la base de datos)
docker-compose down -v

# Consultar la base de datos directamente
docker exec -it component_a_db psql -U postgres -d component_a
```
