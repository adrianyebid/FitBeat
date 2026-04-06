# Music Service (Componente B)

`music-service` es el **Componente B (Music & Biometric Engine)** de la arquitectura FitBeat.

En esta iteracion, el servicio se enfoca en:

- crear sesiones de entrenamiento
- recibir biometria (BPM)
- calcular intensidad de esfuerzo
- recomendar un track mock segun BPM
- persistir sesiones, biometria y decisiones en un repository in-memory

## Estado actual del componente

Esta version ya soporta el flujo base de decision musical en tiempo real por request/response HTTP.

No hay integraciones externas reales aun (Spotify, SSE, componente A o base de datos persistente).

## Tecnologias

- Go
- Gin (HTTP API)
- Persistencia en memoria (`in-memory repository`)

## Ejecucion local

```bash
cd backend/music-service
go run cmd/main.go
```

Variables de entorno:

- `PORT` (default: `8081`)
- `ENV` (default: `development`)

## Endpoints actuales

Base URL: `http://localhost:8081`

- `GET /api/v1/health`
- `POST /api/v1/sessions`
- `POST /api/v1/biometrics`

> Nota: no hay otros endpoints expuestos en esta iteracion.

## Dominio actual

### Sesion de entrenamiento

Campos de entrada requeridos:

- `user_id` (string)
- `activity_type` (string)
- `mode` (string): usar valores de dominio actuales como `manual` o `smartwatch`

### Biometria

Campos de entrada requeridos:

- `session_id` (string)
- `heart_rate` (int > 0)

### Reglas de intensidad

- `heart_rate < 100` => `low_intensity`
- `100 <= heart_rate < 140` => `medium_intensity`
- `heart_rate >= 140` => `high_intensity`

## Flujo actual (paso a paso)

1. El cliente crea una sesion con `POST /api/v1/sessions`.
2. El servicio valida campos obligatorios (`user_id`, `activity_type`, `mode`).
3. La sesion se guarda en memoria y se retorna su `id`.
4. El cliente envia una lectura BPM con `POST /api/v1/biometrics` usando `session_id`.
5. El servicio valida:
   - `session_id` presente
   - `heart_rate > 0`
   - sesion existente
6. Se guarda la lectura biometrica en memoria.
7. El motor calcula intensidad segun BPM.
8. El motor selecciona un track mock segun intensidad.
9. Se guarda la decision en memoria y se retorna al cliente.

## Ejemplos de uso

### Health

```http
GET /api/v1/health
```

Response `200 OK`:

```json
{
  "status": "ok",
  "service": "music-biometric-engine"
}
```

### Crear sesion

Request:

```http
POST /api/v1/sessions
Content-Type: application/json
```

```json
{
  "user_id": "user_123",
  "activity_type": "running",
  "mode": "smartwatch"
}
```

Response `201 Created` (ejemplo):

```json
{
  "data": {
    "id": "session_1741450000000000000_1",
    "user_id": "user_123",
    "activity_type": "running",
    "mode": "smartwatch",
    "created_at": "2026-03-08T21:00:00Z"
  }
}
```

Error de validacion `400 Bad Request` (ejemplo):

```json
{
  "message": "validation failed",
  "details": [
    "user_id is required",
    "mode is required"
  ]
}
```

### Procesar biometrico y recomendar track

Request:

```http
POST /api/v1/biometrics
Content-Type: application/json
```

```json
{
  "session_id": "session_1741450000000000000_1",
  "heart_rate": 146
}
```

Response `200 OK` (ejemplo):

```json
{
  "data": {
    "id": "decision_1741450001000000000_3",
    "session_id": "session_1741450000000000000_1",
    "heart_rate": 146,
    "intensity_level": "high_intensity",
    "track": {
      "id": "high_1",
      "title": "Sprint Mode",
      "artist": "FitBeat Mock",
      "duration": 176,
      "intensity": "high_intensity"
    },
    "decided_at": "2026-03-08T21:00:01Z"
  }
}
```

Sesion no existente `404 Not Found` (ejemplo):

```json
{
  "message": "session not found",
  "details": [
    "session_id does not exist"
  ]
}
```

## Persistencia y alcance actual

El repository en memoria guarda:

- sesiones
- lecturas biometricas
- decisiones de track

Implicaciones:

- los datos se pierden al reiniciar el proceso
- no hay escalado horizontal con estado compartido
- no existe auditoria persistente ni historico duradero

## Limitaciones actuales

- sin integracion real con Spotify u otro proveedor musical
- sin SSE ni streaming push de recomendaciones
- sin autenticacion/autorizacion
- sin base de datos NoSQL/SQL persistente
- sin contrato formal versionado entre componentes
- sin pruebas de carga para volumen alto de biometria

## Integraciones futuras esperadas

- integracion con Componente A para ingesta de biometria en tiempo real
- integracion con proveedor musical real para catalogo y playback context-aware
- capa de persistencia real (NoSQL o SQL) para sesiones/biometria/decisiones
- eventos en tiempo real (SSE o mensajeria) para recomendaciones continuas
- observabilidad (tracing, metricas, logging estructurado)

## Proximos pasos sugeridos

1. Definir contrato de entrada/salida con Componente A (payloads, errores, versionado).
2. Agregar endpoints de consulta para historial de decisiones y biometria por sesion.
3. Incorporar tests unitarios de reglas BPM e integracion basica HTTP.
4. Introducir persistencia real manteniendo la interfaz de repository actual.
5. Preparar estrategia de idempotencia y deduplicacion de eventos biometricos.

## Contratos pendientes por definir con el equipo

- Catalogo de `activity_type` permitido y su semantica.
- Valores oficiales de `mode` (`manual`, `smartwatch`, otros) y validacion formal.
- Frecuencia esperada de envio de BPM y tolerancia a latencia.
- Politica de errores estandar (`message`, `details`, codigos) entre componentes.
- Versionado de API (`/api/v1`) y politica de cambios backward-compatible.
- Criterios de negocio para evolucionar la regla de intensidad (zonas por usuario, edad, objetivo).
