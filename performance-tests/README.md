# FitBeat — Pruebas de Rendimiento

## Arquitectura del test

```
[k6 node]  →  Traefik :8090  →  KrakenD :8085  →  user-service :8000  →  PostgreSQL
                                                          ↑
                                               (no llama a Spotify)
                               (otros endpoints) → spotify_mock :3000
```

**Endpoint probado:** `POST /api/auth/login`  
**Ruta completa:** Cliente → Traefik → KrakenD → user-service (FastAPI) → PostgreSQL

---

## Paso 1 — Levantar el sistema con el mock de Spotify

```bash
# Modo producción (Spotify real)
docker compose up -d

# Modo performance test (Spotify mockeado)
SPOTIFY_TOKEN_URL=http://spotify_mock:3000/api/token \
SPOTIFY_ME_URL=http://spotify_mock:3000/v1/me \
SPOTIFY_NOW_PLAYING_URL=http://spotify_mock:3000/v1/me/player/currently-playing \
SPOTIFY_SEARCH_URL=http://spotify_mock:3000/v1/search \
SPOTIFY_QUEUE_URL=http://spotify_mock:3000/v1/me/player/queue \
docker compose up -d
```

Verificar que el mock responde:
```bash
curl http://localhost:3001/health
# {"status":"ok","service":"spotify-mock"}
```

---

## Paso 2 — Instalar k6

```bash
# macOS
brew install k6

# Windows (Chocolatey)
choco install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker (sin instalar k6 localmente)
docker run --rm -i --network host grafana/k6 run - < performance-tests/k6/performance_test.js
```

---

## Paso 3 — Ejecutar los casos de prueba

Todos los comandos se ejecutan desde la raíz del proyecto:

### Caso 1 — Baseline (1 VU, 30 s)

```bash
k6 run performance-tests/k6/performance_test.js
```

Salida esperada:
```
✓ status is 200
✓ has access_token

http_req_duration.............: avg=45ms   min=30ms   med=42ms   max=120ms  p(90)=65ms   p(95)=80ms
http_req_failed...............: 0.00%
```

### Caso 2 — Load (50 VUs, 30 s)

```bash
k6 run performance-tests/k6/case2_load.js

# o usando el script parametrizable:
k6 run -e SCENARIO=case2 performance-tests/k6/performance_test.js
```

### Caso 3 — Stress escalado (1 → 50 → 200 → 500 → 2000 VUs)

```bash
k6 run performance-tests/k6/case3_stress.js

# o usando el script parametrizable:
k6 run -e SCENARIO=case3 performance-tests/k6/performance_test.js
```

Con salida JSON para graficar:
```bash
k6 run --out json=performance-tests/results/stress_results.json performance-tests/k6/case3_stress.js
```

### Apuntar a un host remoto

```bash
k6 run -e BASE_URL=http://mi-servidor:8090 performance-tests/k6/case3_stress.js
```

---

## Paso 4 — Métricas a analizar

| Métrica | Significado |
|---------|-------------|
| `http_req_duration` | Latencia total de cada petición (incluye DNS, TCP, TLS, envío, espera, recepción) |
| `http_req_failed` | Tasa de errores (timeouts + 4xx/5xx que k6 marca como fallo) |
| `login_duration_ms` | Duración personalizada del endpoint de login (Trend) |
| `login_fail_rate` | Rate de iteraciones fallidas |

Campos clave de `http_req_duration`:
- **avg** — promedio general
- **p(90)** — 90% de las peticiones tardaron menos que este valor
- **p(95)** — umbral de referencia para SLA

---

## Paso 5 — Identificar el "knee of the curve"

El *knee* (punto de quiebre) es la etapa donde ocurre **cualquiera** de estas condiciones por primera vez:

1. `p(95)` de `http_req_duration` crece más del doble respecto a la etapa anterior
2. `http_req_failed > 0` (primeros errores)
3. La tasa de crecimiento de latencia vs. VUs deja de ser lineal

### Cómo leerlo del output del Caso 3

```
default ↗ 50 vus  │ http_req_duration p(95)= 95ms   │ failures= 0
default ↗ 200 vus │ http_req_duration p(95)= 210ms  │ failures= 0
default ↗ 500 vus │ http_req_duration p(95)= 980ms  │ failures= 0
default ↗ 2000 vus│ http_req_duration p(95)= 4800ms │ failures= 3.2%  ← KNEE
```

En el ejemplo, el *knee* aparece al pasar de 500 a 2000 VUs.

---

## Paso 6 — Generar gráfica

### Usando k6 + Grafana (recomendado)

```bash
# Levantar InfluxDB + Grafana
docker compose -f performance-tests/docker-compose.monitoring.yml up -d

# Correr test con salida a InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 performance-tests/k6/case3_stress.js
```

Abrir Grafana en `http://localhost:3000` (admin/admin) e importar el dashboard ID **2587** (k6 official).

### Usando el archivo JSON + Python

```bash
k6 run --out json=results.json performance-tests/k6/case3_stress.js

python3 - <<'EOF'
import json, matplotlib.pyplot as plt, collections

points = collections.defaultdict(list)
with open('results.json') as f:
    for line in f:
        obj = json.loads(line)
        if obj.get('type') == 'Point' and obj['metric'] == 'http_req_duration':
            vus = obj['data']['tags'].get('vu', '?')
            points[int(obj['data']['tags'].get('scenario_stage_iter', 0)) // 100].append(obj['data']['value'])

stages = sorted(points)
avgs   = [sum(points[s])/len(points[s]) for s in stages]
plt.plot(stages, avgs, marker='o')
plt.xlabel('Grupo de iteraciones (proxy de VUs)')
plt.ylabel('Latencia promedio (ms)')
plt.title('FitBeat — POST /api/auth/login — Curva de rendimiento')
plt.grid(True)
plt.savefig('performance-tests/results/curve.png', dpi=150)
print('Gráfica guardada en performance-tests/results/curve.png')
EOF
```

---

## Mock de Spotify — detalles

El mock implementado en `performance-tests/spotify-mock/server.js` expone:

| Método | Ruta | Equivalente Spotify real |
|--------|------|--------------------------|
| `POST` | `/api/token` | `https://accounts.spotify.com/api/token` |
| `GET`  | `/v1/me` | `https://api.spotify.com/v1/me` |
| `GET`  | `/v1/me/player/currently-playing` | `...` |
| `GET`  | `/v1/search` | `https://api.spotify.com/v1/search` |
| `POST` | `/v1/me/player/queue` | `https://api.spotify.com/v1/me/player/queue` |
| `PUT`  | `/v1/me/player` | Control de reproducción |
| `GET`  | `/health` | (propio del mock) |

El mock responde en < 5 ms (sin red externa) con datos JSON realistas compatibles con la API de Spotify.

---

## Alternativa con JMeter

Para ejecutar las mismas pruebas en JMeter:

### Thread Group equivalente

| Parámetro | Caso 1 | Caso 2 | Caso 3 (por etapa) |
|-----------|--------|--------|---------------------|
| Number of Threads | 1 | 50 | 1 / 50 / 200 / 500 / 2000 |
| Ramp-up Period (s) | 1 | 5 | 30 |
| Loop Count | Infinite (30s) | Infinite (30s) | Infinite (30s) |

### Configuración del HTTP Sampler

- **Server**: `localhost`
- **Port**: `8090`
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Body Data**:
  ```json
  {"email": "perf@fitbeat.test", "password": "PerfTest123!"}
  ```
- **Header**: `Content-Type: application/json`

### HTTP Recorder (puerto 8888)

```
JMeter → Options → Proxy → Start
Proxy port: 8888
Target controller: Test Plan > Thread Group

En el navegador:
  proxy: localhost:8888
  navegar a: http://localhost:8090/api/auth/login
```

### Summary Report

Añadir **Listeners > Summary Report** y **Listeners > Response Time Graph** al Thread Group.

---

## Buenas prácticas aplicadas

- El mock elimina la dependencia de red y el rate limiting de Spotify
- `setup()` registra el usuario de prueba una sola vez; los VUs solo hacen login
- `sleep(1)` simula el tiempo de "think time" de un usuario real
- Cada test limpia su estado con usuarios únicos por timestamp
- Los umbrales (`thresholds`) en k6 hacen que el test falle automáticamente si SLA se rompe
- `teardown()` deja trazabilidad del test en los logs
