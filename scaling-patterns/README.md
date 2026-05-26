# Load Balancer Pattern - FitBeat Scaling Demo

## Overview

This directory demonstrates the **Load Balancer Pattern** for horizontal scaling, based on Laboratory 7 concepts but adapted to the FitBeat microservices architecture.

### Key Objectives

1. **Horizontal Scaling**: Deploy multiple identical, stateless replicas of a service using Docker Compose.
2. **Load Balancing**: Use Nginx to distribute incoming requests across replicas using three different balancing algorithms:
   - **Round Robin** (default): Strict rotation across replicas
   - **Least Connections**: Route to the replica with fewest active connections
   - **IP Hash**: Sticky sessions; same client IP always reaches the same replica
3. **Instance Identification**: Each response identifies which replica processed it, making distribution observable.

---

## Architecture

### Current FitBeat Setup

Your FitBeat system uses:
- **Traefik**: Edge reverse proxy (DMZ layer)
- **KrakenD**: API Gateway (routes to individual microservices)
- **Microservices**: `user-service`, `music-service`, `achievements-service`, `notification-service`, `event-processor`
- **Network Segmentation**: Separate networks for API, databases, messaging

### Scaling Pattern Applied

This demo shows **how to scale individual stateless services horizontally**:

```
                    ┌──────────────────────┐
                    │   Nginx (80)         │
                    │  Load Balancer       │
                    └────┬────────┬────┬───┘
                         │        │    │
            ┌────────────┬┘        │    └┬────────────┐
            │                      │                  │
        ┌───▼──┐           ┌───────▼──┐         ┌────▼──┐
        │Replica1│        │Replica 2│         │Replica3│
        │:5000   │        │:5000    │         │:5000   │
        └────────┘        └─────────┘         └─────────┘
        (Stateless)       (Stateless)        (Stateless)
```

Key principle: **Statefulness is the barrier to horizontal scaling**. Services that store session data locally cannot be freely replicated without a shared state store (e.g., Redis, database).

---

## How to Use This Demo

### 1. Prerequisites

- Docker and Docker Compose installed
- `curl` available in terminal
- Optional: `ab` (Apache Bench) for load testing

### 2. Start the System (Round Robin)

```bash
cd scaling-patterns
docker-compose -f docker-compose-scaling.yml up --build -d
```

Verify all containers are running:

```bash
docker-compose -f docker-compose-scaling.yml ps
```

Expected output:
```
fitbeat_replica_1     Running
fitbeat_replica_2     Running
fitbeat_replica_3     Running
fitbeat_load_balancer Running
```

### 3. Test the Load Balancer

#### Single Request

```bash
curl -s http://localhost/api/stats | python3 -m json.tool
```

Expected response:
```json
{
  "instance": "fitbeat_replica_2",
  "port": "5000",
  "message": "This is a horizontally scalable FitBeat replica",
  "note": "When load balancer distributes requests, observe how different instances handle them"
}
```

#### Observe Round-Robin Distribution

Send 9 consecutive requests. Each replica should handle approximately 3 requests:

```bash
for i in {1..9}; do
  curl -s http://localhost/api/workout-session | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['instance'])"
done
```

Expected output pattern:
```
fitbeat_replica_1
fitbeat_replica_2
fitbeat_replica_3
fitbeat_replica_1
fitbeat_replica_2
fitbeat_replica_3
fitbeat_replica_1
fitbeat_replica_2
fitbeat_replica_3
```

#### Test Different Endpoints

- **Workout Session**: `curl http://localhost/api/workout-session?session_id=123`
- **Achievements**: `curl http://localhost/api/achievements?user_id=user1`
- **Notifications**: `curl http://localhost/api/notification?user_id=user1`
- **Stats**: `curl http://localhost/api/stats`
- **Health**: `curl http://localhost/health`

### 4. Switch Load Balancing Algorithm

#### To Least Connections

Edit `docker-compose-scaling.yml` and change the load-balancer volumes section:

```yaml
load-balancer:
  ...
  volumes:
    - ./nginx/nginx.least-conn.conf:/etc/nginx/nginx.conf:ro
```

Recreate only the load-balancer container (backends keep running):

```bash
docker-compose -f docker-compose-scaling.yml up -d --no-deps load-balancer
```

Verify configuration loaded:

```bash
docker logs fitbeat_load_balancer | head -20
```

Test distribution (with simulated variable processing times, least_conn should balance more evenly):

```bash
for i in {1..15}; do
  curl -s http://localhost/api/achievements | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d['instance']} ({d['processing_ms']}ms)\")"
done
```

#### To IP Hash (Sticky Sessions)

Edit `docker-compose-scaling.yml` and change the load-balancer volumes section:

```yaml
load-balancer:
  ...
  volumes:
    - ./nginx/nginx.ip-hash.conf:/etc/nginx/nginx.conf:ro
```

Recreate the load-balancer:

```bash
docker-compose -f docker-compose-scaling.yml up -d --no-deps load-balancer
```

Test stickiness (all requests should return the same instance):

```bash
for i in {1..6}; do
  curl -s http://localhost/api/notification | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['instance'])"
done
```

Expected output (all the same instance):
```
fitbeat_replica_1
fitbeat_replica_1
fitbeat_replica_1
fitbeat_replica_1
fitbeat_replica_1
fitbeat_replica_1
```

### 5. Scaling Operations

#### Stop a Replica (Simulate Failure)

```bash
docker-compose -f docker-compose-scaling.yml stop replica_3
```

Observe that requests still succeed, distributed across remaining replicas:

```bash
for i in {1..6}; do
  curl -s http://localhost/api/workout-session | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['instance'])"
done
```

Expected: only `fitbeat_replica_1` and `fitbeat_replica_2` appear.

#### Restore the Replica

```bash
docker-compose -f docker-compose-scaling.yml start replica_3
```

Confirm it re-enters the pool:

```bash
for i in {1..9}; do
  curl -s http://localhost/api/workout-session | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['instance'])"
done
```

Expected: all three replicas now appear.

### 6. Load Testing (Optional)

If Apache Bench is installed, run a load test:

```bash
ab -n 300 -c 10 http://localhost/api/workout-session
```

Key metrics:
- **Requests per second**: Should improve with more replicas
- **Time per request**: Should decrease due to parallel processing
- **Failed requests**: Should be 0

Repeat with `replica_3` stopped and compare:

```bash
docker-compose -f docker-compose-scaling.yml stop replica_3
ab -n 300 -c 10 http://localhost/api/workout-session
```

Note the decrease in throughput with fewer replicas.

### 7. Monitor Nginx Logs

Tail Nginx access logs in real time to observe distribution:

```bash
docker logs -f fitbeat_load_balancer
```

---

## Applying to Your FitBeat Microservices

### Strategy for Scaling Existing Services

The services in your FitBeat are already **stateless and suitable for horizontal scaling**:

| Service | Suitable for Scaling | Notes |
|---------|----------------------|-------|
| `user-service` | ✓ Yes | Stateless; state in PostgreSQL |
| `music-service` | ✓ Yes | Stateless; state in CouchDB |
| `achievements-service` | ✓ Yes | Stateless; state in PostgreSQL |
| `notification-service` | ✓ Yes | Stateless; state in PostgreSQL |
| `event-processor` | ✓ Yes | Stateless; async consumer |

### Implementation Steps for Production

#### 1. Modify Main docker-compose.yml

Instead of single service instances, define replicas:

```yaml
# OLD (single instance)
music_service:
  build: ./backend/music-service
  container_name: fb_music_ms
  ...

# NEW (multiple replicas)
music_service_1:
  build: ./backend/music-service
  container_name: fb_music_ms_1
  ...
music_service_2:
  build: ./backend/music-service
  container_name: fb_music_ms_2
  ...
music_service_3:
  build: ./backend/music-service
  container_name: fb_music_ms_3
  ...
```

#### 2. Add Nginx or Enhance KrakenD

**Option A: Use Nginx** (similar to this demo)
- Create Nginx upstream groups for each service
- Route requests through Nginx instead of directly to services

**Option B: Enhance KrakenD** (recommended for existing setup)
- KrakenD already supports multiple backends for a single endpoint
- Configure it to round-robin across multiple replica addresses:

```json
{
  "backend": [
    {
      "host": "music_service_1",
      "port": 8081
    },
    {
      "host": "music_service_2",
      "port": 8081
    },
    {
      "host": "music_service_3",
      "port": 8081
    }
  ]
}
```

#### 3. Network Configuration

Ensure replicas are on the same network as KrakenD:

```yaml
networks:
  api_gateway_net:
    driver: bridge
```

All replicas should connect to `api_gateway_net`.

---

## Load Balancing Algorithms Comparison

| Algorithm | Nginx Directive | How It Works | Best For |
|-----------|------------------|--------------|----------|
| **Round Robin** | *(default, no directive)* | Requests cycle sequentially: 1 → 2 → 3 → 1 → ... | Homogeneous replicas with similar request costs |
| **Least Connections** | `least_conn` | Each request goes to replica with fewest active connections | Mixed workloads; variable processing times |
| **IP Hash** | `ip_hash` | Client IP is hashed; same client always reaches same replica | Session affinity without shared session store |

---

## Benefits of Horizontal Scaling

### Performance
- **Throughput**: Single instance handles N requests/sec; k replicas handle ~k×N requests/sec
- **Response Time**: Load distributed across multiple cores and machines

### Availability
- **Fault Tolerance**: Failure of one replica doesn't take down the service
- **Graceful Degradation**: With 3 replicas, losing one means 66% capacity remains
- **Zero-Downtime Deployment**: Drain traffic from one replica, deploy update, restore

### Example with FitBeat

Current single instance:
- User service: 100 req/sec capacity
- 1 failure = complete outage

With 3 replicas:
- User service: 300 req/sec capacity
- 1 failure = 200 req/sec (66% degradation, not 0%)
- Better user experience during failures or updates

---

## Key Takeaways

1. **Statefulness is the barrier**: Ensure services don't store session data in memory.
2. **Service independence**: Replicas should be identical and interchangeable.
3. **Network segmentation**: Replicas and load balancer should be on isolated networks.
4. **Health checking**: Load balancers should verify replica health before routing.
5. **Observability**: Include instance identifiers in responses to verify distribution.

---

## Next Steps

1. Study the three Nginx configurations in `./nginx/`
2. Understand how KrakenD routes in your current setup
3. Plan which services to scale first (start with stateless ones)
4. Test using this demo before applying to production
5. Monitor performance metrics (throughput, latency) before/after scaling

---

## References

- [Nginx Documentation: Upstream](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [Nginx Load Balancing Algorithms](https://nginx.org/en/docs/http/load_balancing.html)
- [KrakenD Multiple Backends](https://www.krakend.io/docs/backends/)
- [Software Architecture: Horizontal Scaling Pattern](https://en.wikipedia.org/wiki/Horizontal_scaling)

---

## Troubleshooting

### Load Balancer Not Reaching Replicas

Check if replicas are on the correct network:
```bash
docker network inspect scaling_fitbeat_replicas_net
```

### Configuration Not Applied

After editing nginx config:
```bash
docker-compose -f docker-compose-scaling.yml up -d --no-deps load-balancer
docker logs fitbeat_load_balancer
```

### Requests Stuck or Timing Out

Check health endpoints:
```bash
curl -v http://localhost/health
curl -v http://localhost/api/stats
```

Check Nginx logs for errors:
```bash
docker exec fitbeat_load_balancer nginx -T
```

### Performance Not Improving

1. Verify replicas are actually running:
   ```bash
   docker-compose -f docker-compose-scaling.yml ps
   ```

2. Check if CPU/memory is bottleneck on host machine
3. Confirm load test is actually concurrent (use `-c` flag in `ab`)
4. Monitor individual replica health:
   ```bash
   docker stats
   ```
