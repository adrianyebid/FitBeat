# FitBeat Scaling: Service-Specific Configuration Examples

This file shows **exact code snippets** for scaling each FitBeat service using the Load Balancer Pattern.

## Architecture Diagram (After Scaling)

```
┌─────────────────────────────────────────┐
│         Traefik (DMZ)                   │
│  public: 8090/80, 443/HTTPS             │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│      KrakenD (API Gateway)              │
│   Internal: 8085                        │
│   Routes to load-balanced pools         │
└──┬──┬──┬──┬──┬────────────┬────────┬─┬─┘
   │  │  │  │  │            │        │ │
   │  │  │  │  │    ┌────────────────┘ │
   │  │  │  │  │    │                  │
   ▼  ▼  ▼  ▼  ▼    ▼                  ▼
  U1 U2 U3 M1 M2 A1 A2 A3  N1 N2  EP1 EP2
  (Scaled Services)
  
Where:
  U = user-service replica
  M = music-service replica
  A = achievements-service replica
  N = notification-service replica
  EP = event-processor replica
```

---

## 1. Scale User Service (component_a)

### Docker Compose Configuration

Replace the existing `component_a` service with:

```yaml
# User Service - Replica 1 (Primary, exposed for debugging)
component_a_1:
  build: ./backend/user-service
  container_name: fb_users_ms_1
  command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
  volumes:
    - ./backend/user-service:/app
  ports:
    - "8000:8000"  # Exposed for direct debugging
  env_file:
    - .env
  environment:
    DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres_db:5432/${POSTGRES_DB}
    SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID}
    SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET}
    REDIRECT_URI: ${REDIRECT_URI}
    ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    SPOTIFY_TOKEN_URL: ${SPOTIFY_TOKEN_URL:-https://accounts.spotify.com/api/token}
    SPOTIFY_ME_URL: ${SPOTIFY_ME_URL:-https://api.spotify.com/v1/me}
    SPOTIFY_NOW_PLAYING_URL: ${SPOTIFY_NOW_PLAYING_URL:-https://api.spotify.com/v1/me/player/currently-playing}
  depends_on:
    postgres_db:
      condition: service_healthy
  networks:
    - api_gateway_net
    - users_db_net
    - services_internal_net
  restart: always

# User Service - Replica 2
component_a_2:
  build: ./backend/user-service
  container_name: fb_users_ms_2
  command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
  volumes:
    - ./backend/user-service:/app
  # No ports exposed
  env_file:
    - .env
  environment:
    DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres_db:5432/${POSTGRES_DB}
    SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID}
    SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET}
    REDIRECT_URI: ${REDIRECT_URI}
    ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    SPOTIFY_TOKEN_URL: ${SPOTIFY_TOKEN_URL:-https://accounts.spotify.com/api/token}
    SPOTIFY_ME_URL: ${SPOTIFY_ME_URL:-https://api.spotify.com/v1/me}
    SPOTIFY_NOW_PLAYING_URL: ${SPOTIFY_NOW_PLAYING_URL:-https://api.spotify.com/v1/me/player/currently-playing}
  depends_on:
    postgres_db:
      condition: service_healthy
  networks:
    - api_gateway_net
    - users_db_net
    - services_internal_net
  restart: always

# User Service - Replica 3
component_a_3:
  build: ./backend/user-service
  container_name: fb_users_ms_3
  command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
  volumes:
    - ./backend/user-service:/app
  env_file:
    - .env
  environment:
    DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres_db:5432/${POSTGRES_DB}
    SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID}
    SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET}
    REDIRECT_URI: ${REDIRECT_URI}
    ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    SPOTIFY_TOKEN_URL: ${SPOTIFY_TOKEN_URL:-https://accounts.spotify.com/api/token}
    SPOTIFY_ME_URL: ${SPOTIFY_ME_URL:-https://api.spotify.com/v1/me}
    SPOTIFY_NOW_PLAYING_URL: ${SPOTIFY_NOW_PLAYING_URL:-https://api.spotify.com/v1/me/player/currently-playing}
  depends_on:
    postgres_db:
      condition: service_healthy
  networks:
    - api_gateway_net
    - users_db_net
    - services_internal_net
  restart: always
```

### KrakenD Configuration Updates

Add to endpoints that route to user-service:

```json
{
  "endpoint": "/api/auth/register",
  "method": "POST",
  "backend": [
    {
      "url_pattern": "/auth/register",
      "host": [
        "component_a_1:8000",
        "component_a_2:8000",
        "component_a_3:8000"
      ],
      "method": "POST",
      "balancing_strategy": "round_robin"
    }
  ]
}
```

---

## 2. Scale Music Service

### Docker Compose Configuration

Replace the existing `music_service` with:

```yaml
# Music Service - Replica 1
music_service_1:
  build: ./backend/music-service
  container_name: fb_music_ms_1
  ports:
    - "8081:8081"  # Exposed for debugging
  environment:
    PORT: "8081"
    COUCHDB_ADDR: "${COUCHDB_USER:-admin}:${COUCHDB_PASSWORD:-secret}@couchdb:5984"
    EVENTS_ENABLED: "true"
    RABBITMQ_URL: "amqp://${RABBITMQ_USER:-guest}:${RABBITMQ_PASS:-guest}@rabbitmq:5672/"
    RABBITMQ_EVENTS_EXCHANGE: ${RABBITMQ_EVENTS_EXCHANGE:-fitbeat.events}
    EVENT_SOURCE: music-service
    SPOTIFY_SEARCH_URL: ${SPOTIFY_SEARCH_URL:-https://api.spotify.com/v1/search}
    SPOTIFY_QUEUE_URL: ${SPOTIFY_QUEUE_URL:-https://api.spotify.com/v1/me/player/queue}
  depends_on:
    couchdb:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  networks:
    - api_gateway_net
    - music_db_net
    - messaging_net
  restart: always

# Music Service - Replica 2
music_service_2:
  build: ./backend/music-service
  container_name: fb_music_ms_2
  environment:
    PORT: "8081"
    COUCHDB_ADDR: "${COUCHDB_USER:-admin}:${COUCHDB_PASSWORD:-secret}@couchdb:5984"
    EVENTS_ENABLED: "true"
    RABBITMQ_URL: "amqp://${RABBITMQ_USER:-guest}:${RABBITMQ_PASS:-guest}@rabbitmq:5672/"
    RABBITMQ_EVENTS_EXCHANGE: ${RABBITMQ_EVENTS_EXCHANGE:-fitbeat.events}
    EVENT_SOURCE: music-service
    SPOTIFY_SEARCH_URL: ${SPOTIFY_SEARCH_URL:-https://api.spotify.com/v1/search}
    SPOTIFY_QUEUE_URL: ${SPOTIFY_QUEUE_URL:-https://api.spotify.com/v1/me/player/queue}
  depends_on:
    couchdb:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  networks:
    - api_gateway_net
    - music_db_net
    - messaging_net
  restart: always

# Music Service - Replica 3
music_service_3:
  build: ./backend/music-service
  container_name: fb_music_ms_3
  environment:
    PORT: "8081"
    COUCHDB_ADDR: "${COUCHDB_USER:-admin}:${COUCHDB_PASSWORD:-secret}@couchdb:5984"
    EVENTS_ENABLED: "true"
    RABBITMQ_URL: "amqp://${RABBITMQ_USER:-guest}:${RABBITMQ_PASS:-guest}@rabbitmq:5672/"
    RABBITMQ_EVENTS_EXCHANGE: ${RABBITMQ_EVENTS_EXCHANGE:-fitbeat.events}
    EVENT_SOURCE: music-service
    SPOTIFY_SEARCH_URL: ${SPOTIFY_SEARCH_URL:-https://api.spotify.com/v1/search}
    SPOTIFY_QUEUE_URL: ${SPOTIFY_QUEUE_URL:-https://api.spotify.com/v1/me/player/queue}
  depends_on:
    couchdb:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  networks:
    - api_gateway_net
    - music_db_net
    - messaging_net
  restart: always
```

### KrakenD Configuration Updates

```json
{
  "endpoint": "/api/v1/sessions",
  "method": "POST",
  "backend": [
    {
      "url_pattern": "/api/v1/sessions",
      "host": [
        "music_service_1:8081",
        "music_service_2:8081",
        "music_service_3:8081"
      ],
      "method": "POST",
      "balancing_strategy": "round_robin"
    }
  ]
}
```

---

## 3. Scale Achievements Service

### Docker Compose Configuration

Replace the existing `achievements_service` with:

```yaml
# Achievements Service - Replica 1
achievements_service_1:
  build: ./backend/achievements-service
  container_name: fb_achievements_ms_1
  ports:
    - "8082:8082"
  environment:
    ASPNETCORE_URLS: http://0.0.0.0:8082
    ACHIEVEMENTS_DATABASE_URL: Host=achievements_db;Port=5432;Database=${ACH_POSTGRES_DB};Username=${ACH_POSTGRES_USER};Password=${ACH_POSTGRES_PASSWORD}
    ACHIEVEMENTS_DB_PATH: ${ACHIEVEMENTS_DB_PATH:-/app/Data/achievements.db}
    FRONTEND_APP_URL: ${FRONTEND_APP_URL:-http://localhost:5173}
    RABBITMQ_HOST: rabbitmq
    RABBITMQ_PORT: 5672
    RABBITMQ_USER: ${RABBITMQ_USER:-guest}
    RABBITMQ_PASS: ${RABBITMQ_PASS:-guest}
    RABBITMQ_EVENTS_EXCHANGE: ${RABBITMQ_EVENTS_EXCHANGE:-fitbeat.events}
    RABBITMQ_DLX_EXCHANGE: ${RABBITMQ_DLX_EXCHANGE:-fitbeat.events.dlx}
    ACHIEVEMENTS_QUEUE_NAME: ${ACHIEVEMENTS_QUEUE_NAME:-fitbeat.achievements.q}
    ACHIEVEMENTS_RETRY_QUEUE_NAME: ${ACHIEVEMENTS_RETRY_QUEUE_NAME:-fitbeat.achievements.retry.q}
    ACHIEVEMENTS_DLQ_NAME: ${ACHIEVEMENTS_DLQ_NAME:-fitbeat.achievements.dlq}
    ACHIEVEMENTS_RETRY_ROUTING_KEY: ${ACHIEVEMENTS_RETRY_ROUTING_KEY:-fitbeat.achievements.retry}
    ACHIEVEMENTS_DLQ_ROUTING_KEY: ${ACHIEVEMENTS_DLQ_ROUTING_KEY:-fitbeat.achievements.dlq}
    ACHIEVEMENTS_MAX_RETRIES: ${ACHIEVEMENTS_MAX_RETRIES:-3}
    ACHIEVEMENTS_RETRY_DELAY_MS: ${ACHIEVEMENTS_RETRY_DELAY_MS:-5000}
    ACHIEVEMENTS_DEFAULT_SESSION_MINUTES: ${ACHIEVEMENTS_DEFAULT_SESSION_MINUTES:-30}
  depends_on:
    achievements_db:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8082/health >/dev/null"]
    interval: 10s
    timeout: 3s
    retries: 10
    start_period: 10s
  networks:
    - api_gateway_net
    - achievements_db_net
    - messaging_net
  restart: always

# Achievements Service - Replica 2
achievements_service_2:
  build: ./backend/achievements-service
  container_name: fb_achievements_ms_2
  environment:
    ASPNETCORE_URLS: http://0.0.0.0:8082
    ACHIEVEMENTS_DATABASE_URL: Host=achievements_db;Port=5432;Database=${ACH_POSTGRES_DB};Username=${ACH_POSTGRES_USER};Password=${ACH_POSTGRES_PASSWORD}
    ACHIEVEMENTS_DB_PATH: ${ACHIEVEMENTS_DB_PATH:-/app/Data/achievements.db}
    FRONTEND_APP_URL: ${FRONTEND_APP_URL:-http://localhost:5173}
    RABBITMQ_HOST: rabbitmq
    RABBITMQ_PORT: 5672
    RABBITMQ_USER: ${RABBITMQ_USER:-guest}
    RABBITMQ_PASS: ${RABBITMQ_PASS:-guest}
    RABBITMQ_EVENTS_EXCHANGE: ${RABBITMQ_EVENTS_EXCHANGE:-fitbeat.events}
    RABBITMQ_DLX_EXCHANGE: ${RABBITMQ_DLX_EXCHANGE:-fitbeat.events.dlx}
    ACHIEVEMENTS_QUEUE_NAME: ${ACHIEVEMENTS_QUEUE_NAME:-fitbeat.achievements.q}
    ACHIEVEMENTS_RETRY_QUEUE_NAME: ${ACHIEVEMENTS_RETRY_QUEUE_NAME:-fitbeat.achievements.retry.q}
    ACHIEVEMENTS_DLQ_NAME: ${ACHIEVEMENTS_DLQ_NAME:-fitbeat.achievements.dlq}
    ACHIEVEMENTS_RETRY_ROUTING_KEY: ${ACHIEVEMENTS_RETRY_ROUTING_KEY:-fitbeat.achievements.retry}
    ACHIEVEMENTS_DLQ_ROUTING_KEY: ${ACHIEVEMENTS_DLQ_ROUTING_KEY:-fitbeat.achievements.dlq}
    ACHIEVEMENTS_MAX_RETRIES: ${ACHIEVEMENTS_MAX_RETRIES:-3}
    ACHIEVEMENTS_RETRY_DELAY_MS: ${ACHIEVEMENTS_RETRY_DELAY_MS:-5000}
    ACHIEVEMENTS_DEFAULT_SESSION_MINUTES: ${ACHIEVEMENTS_DEFAULT_SESSION_MINUTES:-30}
  depends_on:
    achievements_db:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8082/health >/dev/null"]
    interval: 10s
    timeout: 3s
    retries: 10
    start_period: 10s
  networks:
    - api_gateway_net
    - achievements_db_net
    - messaging_net
  restart: always

# Achievements Service - Replica 3
achievements_service_3:
  build: ./backend/achievements-service
  container_name: fb_achievements_ms_3
  environment:
    ASPNETCORE_URLS: http://0.0.0.0:8082
    ACHIEVEMENTS_DATABASE_URL: Host=achievements_db;Port=5432;Database=${ACH_POSTGRES_DB};Username=${ACH_POSTGRES_USER};Password=${ACH_POSTGRES_PASSWORD}
    ACHIEVEMENTS_DB_PATH: ${ACHIEVEMENTS_DB_PATH:-/app/Data/achievements.db}
    FRONTEND_APP_URL: ${FRONTEND_APP_URL:-http://localhost:5173}
    RABBITMQ_HOST: rabbitmq
    RABBITMQ_PORT: 5672
    RABBITMQ_USER: ${RABBITMQ_USER:-guest}
    RABBITMQ_PASS: ${RABBITMQ_PASS:-guest}
    RABBITMQ_EVENTS_EXCHANGE: ${RABBITMQ_EVENTS_EXCHANGE:-fitbeat.events}
    RABBITMQ_DLX_EXCHANGE: ${RABBITMQ_DLX_EXCHANGE:-fitbeat.events.dlx}
    ACHIEVEMENTS_QUEUE_NAME: ${ACHIEVEMENTS_QUEUE_NAME:-fitbeat.achievements.q}
    ACHIEVEMENTS_RETRY_QUEUE_NAME: ${ACHIEVEMENTS_RETRY_QUEUE_NAME:-fitbeat.achievements.retry.q}
    ACHIEVEMENTS_DLQ_NAME: ${ACHIEVEMENTS_DLQ_NAME:-fitbeat.achievements.dlq}
    ACHIEVEMENTS_RETRY_ROUTING_KEY: ${ACHIEVEMENTS_RETRY_ROUTING_KEY:-fitbeat.achievements.retry}
    ACHIEVEMENTS_DLQ_ROUTING_KEY: ${ACHIEVEMENTS_DLQ_ROUTING_KEY:-fitbeat.achievements.dlq}
    ACHIEVEMENTS_MAX_RETRIES: ${ACHIEVEMENTS_MAX_RETRIES:-3}
    ACHIEVEMENTS_RETRY_DELAY_MS: ${ACHIEVEMENTS_RETRY_DELAY_MS:-5000}
    ACHIEVEMENTS_DEFAULT_SESSION_MINUTES: ${ACHIEVEMENTS_DEFAULT_SESSION_MINUTES:-30}
  depends_on:
    achievements_db:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8082/health >/dev/null"]
    interval: 10s
    timeout: 3s
    retries: 10
    start_period: 10s
  networks:
    - api_gateway_net
    - achievements_db_net
    - messaging_net
  restart: always
```

### KrakenD Configuration Updates

```json
{
  "endpoint": "/achievements/catalog",
  "method": "GET",
  "backend": [
    {
      "url_pattern": "/achievements/catalog",
      "host": [
        "achievements_service_1:8082",
        "achievements_service_2:8082",
        "achievements_service_3:8082"
      ],
      "method": "GET",
      "balancing_strategy": "round_robin"
    }
  ]
}
```

---

## 4. Scale Notification Service

### Docker Compose Configuration

```yaml
# Notification Service - Replica 1
notification_service_1:
  build: ./backend/notification-service
  container_name: fb_notification_ms_1
  ports:
    - "8083:8083"
  environment:
    PORT: "8083"
    NOTIFICATION_DB_URL: postgresql://${NOTIFICATION_DB_USER:-postgres}:${NOTIFICATION_DB_PASSWORD:-postgres}@notification_service_db:5432/${NOTIFICATION_DB_NAME:-notification_service}
    RABBITMQ_URL: amqp://${RABBITMQ_USER:-guest}:${RABBITMQ_PASS:-guest}@rabbitmq:5672/
    RABBITMQ_EVENTS_EXCHANGE: ${RABBITMQ_EVENTS_EXCHANGE:-fitbeat.events}
    NOTIFICATION_QUEUE_NAME: ${NOTIFICATION_QUEUE_NAME:-fitbeat.notification.q}
    NOTIFICATION_RETRY_QUEUE_NAME: ${NOTIFICATION_RETRY_QUEUE_NAME:-fitbeat.notification.retry.q}
    NOTIFICATION_DLQ_NAME: ${NOTIFICATION_DLQ_NAME:-fitbeat.notification.dlq}
    NOTIFICATION_DLX_NAME: ${NOTIFICATION_DLX_NAME:-fitbeat.notification.dlx}
    NOTIFICATION_MAX_RETRIES: ${NOTIFICATION_MAX_RETRIES:-3}
    NOTIFICATION_RETRY_DELAY_MS: ${NOTIFICATION_RETRY_DELAY_MS:-5000}
    USER_SERVICE_URL: http://component_a_1:8000
    INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN:-fitbeat-internal-token-2026}
    SMTP_HOST: ${SMTP_HOST:-smtp.gmail.com}
    SMTP_PORT: ${SMTP_PORT:-587}
    SMTP_USER: ${SMTP_USER:-fitbeat1e@gmail.com}
    SMTP_PASS: ${SMTP_PASS:-jdpexgyshtaeywxf}
  depends_on:
    rabbitmq:
      condition: service_healthy
    notification_service_db:
      condition: service_healthy
    component_a_1:
      condition: service_started
  networks:
    - api_gateway_net
    - notification_db_net
    - messaging_net
    - services_internal_net
  restart: always

# Notification Service - Replica 2
notification_service_2:
  build: ./backend/notification-service
  container_name: fb_notification_ms_2
  environment:
    PORT: "8083"
    NOTIFICATION_DB_URL: postgresql://${NOTIFICATION_DB_USER:-postgres}:${NOTIFICATION_DB_PASSWORD:-postgres}@notification_service_db:5432/${NOTIFICATION_DB_NAME:-notification_service}
    RABBITMQ_URL: amqp://${RABBITMQ_USER:-guest}:${RABBITMQ_PASS:-guest}@rabbitmq:5672/
    RABBITMQ_EVENTS_EXCHANGE: ${RABBITMQ_EVENTS_EXCHANGE:-fitbeat.events}
    NOTIFICATION_QUEUE_NAME: ${NOTIFICATION_QUEUE_NAME:-fitbeat.notification.q}
    NOTIFICATION_RETRY_QUEUE_NAME: ${NOTIFICATION_RETRY_QUEUE_NAME:-fitbeat.notification.retry.q}
    NOTIFICATION_DLQ_NAME: ${NOTIFICATION_DLQ_NAME:-fitbeat.notification.dlq}
    NOTIFICATION_DLX_NAME: ${NOTIFICATION_DLX_NAME:-fitbeat.notification.dlx}
    NOTIFICATION_MAX_RETRIES: ${NOTIFICATION_MAX_RETRIES:-3}
    NOTIFICATION_RETRY_DELAY_MS: ${NOTIFICATION_RETRY_DELAY_MS:-5000}
    USER_SERVICE_URL: http://component_a_1:8000
    INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN:-fitbeat-internal-token-2026}
    SMTP_HOST: ${SMTP_HOST:-smtp.gmail.com}
    SMTP_PORT: ${SMTP_PORT:-587}
    SMTP_USER: ${SMTP_USER:-fitbeat1e@gmail.com}
    SMTP_PASS: ${SMTP_PASS:-jdpexgyshtaeywxf}
  depends_on:
    rabbitmq:
      condition: service_healthy
    notification_service_db:
      condition: service_healthy
  networks:
    - api_gateway_net
    - notification_db_net
    - messaging_net
    - services_internal_net
  restart: always
```

---

## 5. Update KrakenD Dependencies

After creating replicas, update the `krakend` service depends_on:

```yaml
krakend:
  ...
  depends_on:
    component_a_1:
      condition: service_started
    component_a_2:
      condition: service_started
    component_a_3:
      condition: service_started
    music_service_1:
      condition: service_started
    music_service_2:
      condition: service_started
    music_service_3:
      condition: service_started
    achievements_service_1:
      condition: service_healthy
    achievements_service_2:
      condition: service_healthy
    achievements_service_3:
      condition: service_healthy
    notification_service_1:
      condition: service_started
    notification_service_2:
      condition: service_started
    event_processor:
      condition: service_started
  restart: always
```

---

## Implementation Checklist

- [ ] Backup current docker-compose.yml: `cp docker-compose.yml docker-compose.yml.backup`
- [ ] Backup current krakend.json: `cp krakend/krakend.json krakend/krakend.json.backup`
- [ ] Add replica services to docker-compose.yml
- [ ] Update KrakenD backend hosts for all affected endpoints
- [ ] Add `balancing_strategy: "round_robin"` to KrakenD backends
- [ ] Update KrakenD `depends_on` section
- [ ] Test with: `docker-compose up -d --build`
- [ ] Verify all replicas running: `docker-compose ps`
- [ ] Test endpoint distribution
- [ ] Monitor logs: `docker logs -f fb_api_gateway`
- [ ] Run load tests: `ab -n 1000 -c 10 http://localhost:8090/api/...`
- [ ] Document results and performance metrics

---

## Quick Migration Script

Save as `scale-services.sh`:

```bash
#!/bin/bash

echo "FitBeat Service Scaling Setup"
echo "=============================="
echo ""

# Backup configurations
echo "Backing up configurations..."
cp docker-compose.yml docker-compose.yml.backup.$(date +%s)
cp krakend/krakend.json krakend/krakend.json.backup.$(date +%s)

# Display next steps
echo ""
echo "Next steps:"
echo "1. Edit docker-compose.yml:"
echo "   - Replace 'component_a' with 'component_a_1', 'component_a_2', 'component_a_3'"
echo "   - Replace 'music_service' with replicas"
echo "   - Replace 'achievements_service' with replicas"
echo "   - Replace 'notification_service' with replicas"
echo ""
echo "2. Update krakend/krakend.json:"
echo "   - Change single 'host' to multiple hosts"
echo "   - Add 'balancing_strategy': 'round_robin'"
echo ""
echo "3. Test:"
echo "   docker-compose up -d --build"
echo "   docker-compose ps"
echo "   ab -n 1000 -c 10 http://localhost:8090/api/auth/me"
echo ""
```

---

## Performance Monitoring

After scaling, monitor these metrics:

```bash
# Requests per second per replica
watch -n 1 'docker exec fb_api_gateway tail -n 100 /var/log/nginx/access.log | grep "music_service" | wc -l'

# CPU usage
docker stats --no-stream | grep "fb_"

# Response time distribution
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8090/api/v1/sessions

# Load test
ab -n 10000 -c 50 -r http://localhost:8090/api/auth/me
```
