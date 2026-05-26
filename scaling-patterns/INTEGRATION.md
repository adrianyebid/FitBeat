# Integration Guide: Applying Scaling Pattern to FitBeat Production

This guide shows how to apply the horizontal scaling pattern from `scaling-patterns/` to your existing FitBeat architecture.

## Current Architecture Review

Your FitBeat uses:
- **Traefik** (reverse proxy) → **KrakenD** (API Gateway) → **Microservices** → **Databases**
- Network segmentation: DMZ, API zone, per-service DB networks
- All services are **already stateless** (state is in databases/message queue)

## Implementation Options

### Option 1: KrakenD-Based Load Balancing (Recommended)

**Advantages:**
- No new infrastructure needed
- Integrates seamlessly with existing setup
- Leverages already-deployed KrakenD

**Steps:**

1. **Create Service Replicas** in `docker-compose.yml`:

```yaml
# Example: Scale music-service to 3 replicas

music_service_1:
  build: ./backend/music-service
  container_name: fb_music_ms_1
  ports:
    - "8081:8081"  # Keep first replica exposed for debugging
  environment:
    PORT: "8081"
    # ... other env vars
  networks:
    - api_gateway_net
    - music_db_net
    - messaging_net
  restart: always

music_service_2:
  build: ./backend/music-service
  container_name: fb_music_ms_2
  # No ports exposed; only internally accessible
  environment:
    PORT: "8081"  # All replicas use same internal port
  networks:
    - api_gateway_net
    - music_db_net
    - messaging_net
  restart: always

music_service_3:
  build: ./backend/music-service
  container_name: fb_music_ms_3
  environment:
    PORT: "8081"
  networks:
    - api_gateway_net
    - music_db_net
    - messaging_net
  restart: always
```

2. **Update KrakenD Configuration** (`krakend/krakend.json`):

Before (single backend):
```json
{
  "endpoint": "/api/v1/sessions",
  "method": "GET",
  "backend": [
    {
      "url_pattern": "/api/v1/sessions",
      "host": ["music_service:8081"],  // Single host
      "method": "GET"
    }
  ]
}
```

After (multiple backends with load balancing):
```json
{
  "endpoint": "/api/v1/sessions",
  "method": "GET",
  "backend": [
    {
      "url_pattern": "/api/v1/sessions",
      "host": [
        "music_service_1:8081",
        "music_service_2:8081",
        "music_service_3:8081"
      ],
      "method": "GET",
      "balancing_strategy": "round_robin"  // or "random", "sequential"
    }
  ]
}
```

3. **Update KrakenD Dependencies** in docker-compose.yml:

```yaml
krakend:
  ...
  depends_on:
    music_service_1:
      condition: service_started
    music_service_2:
      condition: service_started
    music_service_3:
      condition: service_started
    # ... repeat for other services
```

**KrakenD Balancing Strategies:**
- `round_robin`: Distributes requests equally
- `random`: Random selection
- `sequential`: Ordered selection
- `least_conn`: Least connections (requires CE Pro)

### Option 2: Nginx-Based Load Balancing

Use Nginx for finer control over load balancing algorithms.

**Steps:**

1. **Add Nginx Service** to docker-compose.yml:

```yaml
lb_music_service:
  image: nginx:alpine
  container_name: lb_music_service
  volumes:
    - ./nginx/music-service-lb.conf:/etc/nginx/nginx.conf:ro
  networks:
    - api_gateway_net
  depends_on:
    - music_service_1
    - music_service_2
    - music_service_3
  restart: always

# Create similar services for other scalable services
```

2. **Create Nginx Configuration** (`nginx/music-service-lb.conf`):

```nginx
events {}

http {
  upstream music_service_pool {
    least_conn;
    server music_service_1:8081;
    server music_service_2:8081;
    server music_service_3:8081;
  }

  server {
    listen 8081;
    server_name localhost;

    location / {
      proxy_pass http://music_service_pool;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_connect_timeout 10s;
      proxy_send_timeout 30s;
      proxy_read_timeout 30s;
    }
  }
}
```

3. **Update KrakenD to Route Through Nginx**:

```json
{
  "endpoint": "/api/v1/sessions",
  "method": "GET",
  "backend": [
    {
      "url_pattern": "/api/v1/sessions",
      "host": ["lb_music_service:8081"],  // Route through Nginx LB
      "method": "GET"
    }
  ]
}
```

---

## Step-by-Step: Scale Music Service (Example)

### Phase 1: Prepare

1. Backup current docker-compose.yml:
   ```bash
   cp docker-compose.yml docker-compose.yml.backup
   ```

2. Review music-service configuration:
   ```bash
   docker-compose ps | grep music_service
   docker logs fb_music_ms
   ```

### Phase 2: Create Replicas

1. Edit docker-compose.yml
2. Replace single `music_service` with `music_service_1`, `music_service_2`, `music_service_3`
3. Ensure all use same environment variables except container names

### Phase 3: Update KrakenD

1. Edit `krakend/krakend.json`
2. Find all endpoints that route to music-service
3. Replace single `host: ["music_service:8081"]` with:
   ```json
   "host": [
     "music_service_1:8081",
     "music_service_2:8081",
     "music_service_3:8081"
   ]
   ```
4. Add `"balancing_strategy": "round_robin"`

### Phase 4: Test

```bash
# Bring up only music replicas and KrakenD
docker-compose up -d --no-deps music_service_1 music_service_2 music_service_3 krakend

# Test requests
for i in {1..9}; do
  curl -s http://localhost:8085/api/v1/sessions | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('instance', 'no-instance-field'))"
done

# Monitor logs
docker logs -f krakend
```

### Phase 5: Monitor Production

```bash
# Check all replicas are running
docker-compose ps | grep music_service

# Monitor resource usage
docker stats

# Check KrakenD routing
docker logs -f fb_api_gateway | grep "music_service"

# Measure performance
ab -n 1000 -c 10 http://localhost:8090/api/v1/sessions
```

---

## Scaling Other Services

### User Service (component_a)

**Stateless?** Yes
**Scale to:** 2-3 replicas

```yaml
component_a_1:
  build: ./backend/user-service
  container_name: fb_users_ms_1
  environment:
    DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres_db:5432/${POSTGRES_DB}
  # ...

component_a_2:
  build: ./backend/user-service
  container_name: fb_users_ms_2
  # ...
```

### Achievements Service

**Stateless?** Yes
**Scale to:** 2-3 replicas

```yaml
achievements_service_1:
  build: ./backend/achievements-service
  container_name: fb_achievements_ms_1
  # ...

achievements_service_2:
  build: ./backend/achievements-service
  container_name: fb_achievements_ms_2
  # ...
```

### Notification Service

**Stateless?** Yes
**Scale to:** 2-3 replicas (async consumers)

```yaml
notification_service_1:
  build: ./backend/notification-service
  container_name: fb_notification_ms_1
  # ...

notification_service_2:
  build: ./backend/notification-service
  container_name: fb_notification_ms_2
  # ...
```

### Event Processor

**Stateless?** Yes
**Scale to:** 2-3 replicas

Note: Multiple consumers on the same queue means automatic workload distribution via RabbitMQ consumer groups.

---

## Monitoring & Observability

### Add Health Checks

Ensure KrakenD knows when replicas are unhealthy:

```json
{
  "endpoint": "/api/v1/health",
  "method": "GET",
  "backend": [
    {
      "url_pattern": "/api/health",
      "host": [
        "music_service_1:8081",
        "music_service_2:8081",
        "music_service_3:8081"
      ],
      "method": "GET"
    }
  ]
}
```

### Logging Distribution

Update logs to show instance ID:

In `app.py` (or respective framework startup):
```python
import socket
INSTANCE_ID = socket.gethostname()
logger.info(f"Service started on instance {INSTANCE_ID}")
```

Then in responses:
```python
return {
    "data": {...},
    "instance": INSTANCE_ID,
    "timestamp": time.time()
}
```

### Metrics Collection

Consider adding Prometheus metrics to monitor:
- Requests per second per replica
- Response time distribution
- Error rates per replica
- Connection counts

---

## Performance Expectations

### Before Scaling
- Single music-service: ~100 req/sec capacity
- Single user-service: ~200 req/sec capacity

### After Scaling to 3 Replicas
- Music-service: ~300 req/sec (3× throughput)
- User-service: ~600 req/sec (3× throughput)

### Actual Improvements Depend On

1. **CPU Cores**: Multi-core systems benefit more
2. **I/O Bottleneck**: If database is bottleneck, scaling services won't help much
3. **Request Type**: Lightweight requests scale better than heavy ones
4. **Database Connections**: May need to increase pool size

---

## Rollback Plan

If scaling causes issues:

1. Revert docker-compose.yml:
   ```bash
   cp docker-compose.yml.backup docker-compose.yml
   ```

2. Revert KrakenD configuration:
   ```bash
   git checkout krakend/krakend.json
   ```

3. Restart with original single instances:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

---

## Troubleshooting

### Requests Failing After Scaling

1. Check if all replicas are running:
   ```bash
   docker-compose ps
   ```

2. Verify replicas can reach database:
   ```bash
   docker exec fb_music_ms_1 ping couchdb
   ```

3. Check KrakenD routing:
   ```bash
   docker logs fb_api_gateway | grep error
   ```

### Uneven Load Distribution

1. Check which algorithm KrakenD is using
2. Verify all replicas have equal resources
3. Monitor actual traffic with:
   ```bash
   docker logs -f fb_music_ms_1
   docker logs -f fb_music_ms_2
   docker logs -f fb_music_ms_3
   ```

### Database Connection Pool Issues

Increase pool size in connection strings:

```
postgresql://user:pass@db:5432/db?pool_size=10&max_overflow=20
```

---

## Next Steps

1. **Start Small**: Scale one service first (music-service recommended)
2. **Test Thoroughly**: Run load tests before production
3. **Monitor Metrics**: Establish baseline before/after
4. **Document Changes**: Keep team updated on configuration
5. **Gradual Rollout**: Scale other services one at a time

---

## Additional Resources

- [KrakenD Backend Configuration](https://www.krakend.io/docs/configuration/backends/)
- [Nginx Upstream Balancing](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [Database Connection Pooling](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections)
- [Load Testing with Apache Bench](https://httpd.apache.org/docs/current/programs/ab.html)
