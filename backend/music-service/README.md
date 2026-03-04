# Music Service

Microservicio en Go encargado de gestionar las canciones y pistas de audio de la plataforma FitBeat. Expone una API REST usando el framework [Gin]

## Requisitos

- [Go 1.22+](https://go.dev/dl/)

## Instalación

```bash
# Clonar el repo y navegar al servicio
cd backend/music-service

# Descargar dependencias
go mod tidy
```

## Configuración

Copia el archivo de ejemplo y ajusta los valores:

```bash
cp .env.example .env
```

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto en el que corre el servicio | `8081` |
| `ENV` | Entorno de ejecución (`development` / `production`) | `development` |


## Estructura del proyecto

```
music-service/
├── cmd/
│   └── main.go                  # Punto de entrada
├── config/
│   └── config.go                # Carga de variables de entorno
├── internal/
│   ├── handler/
│   │   ├── handler.go           # Registro de rutas y health check
│   │   └── track_handler.go     # Endpoints de canciones
│   ├── service/
│   │   └── music_service.go     # Lógica de negocio
│   ├── repository/
│   │   └── music_repository.go  # Interfaz de acceso a datos
│   └── model/
│       └── track.go             # Struct Track
├── go.mod                       # Módulo y dependencias
├── go.sum                       # Lock de versiones
└── .env.example                 # Variables de entorno de ejemplo
```

## Ejecución

```bash
# Modo desarrollo
go run cmd/main.go
```

## Endpoints

Base URL: `http://localhost:8081`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/music/health` | Health check del servicio |
| `GET` | `/api/v1/music/tracks` | Lista de canciones |

### Ejemplos

**Health check**
```http
GET /api/v1/music/health
```
```json
{
  "service": "music-service",
  "status": "ok"
}
```

**Obtener canciones**
```http
GET /api/v1/music/tracks
```
```json
{
  "data": [
    {
      "id": "1",
      "title": "Example Track",
      "artist": "Example Artist",
      "duration": 210
    }
  ]
}
```

## Dependencias principales

| Paquete | Versión | Uso |
|---|---|---|
| `github.com/gin-gonic/gin` | v1.12.0 | Framework HTTP |
