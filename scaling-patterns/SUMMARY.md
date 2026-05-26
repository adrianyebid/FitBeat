# Load Balancer Pattern Implementation - Summary

This directory (`scaling-patterns/`) contains a complete implementation of the **Load Balancer Pattern** for horizontal scaling, based on Laboratory 7 concepts and adapted to the FitBeat microservices architecture.

## 📁 Directory Structure

```
scaling-patterns/
├── backend/                          # Stateless demo service
│   ├── app.py                        # Flask application with multiple endpoints
│   └── Dockerfile                    # Python 3.11 container
├── nginx/                            # Load balancer configurations
│   ├── nginx.round-robin.conf        # Algorithm 1: Sequential distribution
│   ├── nginx.least-conn.conf         # Algorithm 2: Fewest connections
│   └── nginx.ip-hash.conf            # Algorithm 3: Sticky sessions (by IP)
├── docker-compose-scaling.yml        # Orchestration: 3 replicas + Nginx LB
├── README.md                         # Quick start & testing guide
├── INTEGRATION.md                    # How to apply to existing FitBeat services
├── EXAMPLES.md                       # Service-specific configuration examples
└── SUMMARY.md                        # This file
```

## 🎯 What This Implements

### 1. **Horizontal Scaling**
- Three identical, stateless replicas of a service
- Each runs independently in a Docker container
- All connect to the same external resources (databases, message brokers)
- No local session storage (critical for scalability)

### 2. **Load Balancing**
- Nginx distributes incoming requests across replicas
- Three algorithms to choose from:
  - **Round Robin**: Even distribution in rotation
  - **Least Connections**: Smart distribution based on current load
  - **IP Hash**: Sticky sessions for state-affine clients

### 3. **Instance Identification**
- Each response includes which replica handled it
- Makes load distribution **directly observable**
- Essential for validating scaling effectiveness

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Docker & Docker Compose
- curl
- (Optional) Apache Bench (`ab`)

### Launch

```bash
cd scaling-patterns
docker-compose -f docker-compose-scaling.yml up --build -d
```

### Test Round-Robin Distribution

```bash
# Send 9 requests; watch how they're distributed
for i in {1..9}; do
  curl -s http://localhost/api/workout-session | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['instance'])"
done
```

Expected output (each replica gets ~3 requests):
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

### Switch to Least Connections

1. Edit `docker-compose-scaling.yml` volumes section
2. Change: `./nginx/nginx.round-robin.conf` → `./nginx/nginx.least-conn.conf`
3. Recreate load-balancer:
   ```bash
   docker-compose -f docker-compose-scaling.yml up -d --no-deps load-balancer
   ```

### Switch to IP Hash (Sticky Sessions)

1. Edit `docker-compose-scaling.yml` volumes section
2. Change: `./nginx/nginx.round-robin.conf` → `./nginx/nginx.ip-hash.conf`
3. Recreate load-balancer:
   ```bash
   docker-compose -f docker-compose-scaling.yml up -d --no-deps load-balancer
4. Test: All requests from same client should hit same replica:
   ```bash
   for i in {1..6}; do
     curl -s http://localhost/api/notification | \
       python3 -c "import sys,json; d=json.load(sys.stdin); print(d['instance'])"
   done
   ```

## 📚 Documentation

### For Understanding the Pattern
- **README.md** — Complete guide with examples, testing procedures, troubleshooting

### For Applying to FitBeat
- **INTEGRATION.md** — Strategy for scaling your existing microservices
- **EXAMPLES.md** — Copy-paste configurations for each FitBeat service

## 🔄 How the Pattern Works

```
Client Request
    ↓
Nginx (Load Balancer)
    ↓
    ├─→ Replica 1 (port 5000) ─→ Request handled
    ├─→ Replica 2 (port 5000) ─→ Request handled
    └─→ Replica 3 (port 5000) ─→ Request handled
    ↓
Response includes instance ID
    ↓
Client receives {"instance": "replica_2", ...}
```

## 🎯 Key Concepts

### Statefulness is the Barrier
- **Stateless services**: Can be replicated without issues
- **Stateful services**: Need external state store (Redis, database, shared cache)
- **FitBeat services**: All already stateless ✓

### Network Isolation
- Replicas communicate only through internal network
- Load balancer is sole entry point (exposed on port 80)
- Ensures security and scalability

### Algorithm Selection

| Scenario | Choose |
|----------|--------|
| Requests have similar processing time | Round Robin |
| Some requests are slower than others | Least Connections |
| Need session affinity (rare) | IP Hash |

## 📊 Expected Performance Improvements

### Before Scaling (1 replica)
- Throughput: ~100 req/sec
- CPU: May hit 100% under load
- Availability: Single point of failure

### After Scaling (3 replicas)
- Throughput: ~300 req/sec (3× improvement)
- CPU: Distributed across 3 instances (~33% each)
- Availability: Tolerates 1 replica failure

## 🛠️ Applying to FitBeat

### Services Ready for Scaling
- ✓ user-service (stateless, DB-backed)
- ✓ music-service (stateless, document DB-backed)
- ✓ achievements-service (stateless, DB-backed)
- ✓ notification-service (stateless, DB-backed)
- ✓ event-processor (stateless, message-driven)

### Two Approaches

**Option A: KrakenD-Based (Recommended)**
- Modify KrakenD configuration to route to multiple replicas
- No additional infrastructure needed
- Leverages existing API Gateway

**Option B: Nginx-Based**
- Add Nginx load balancers per service
- More control over load balancing algorithms
- More infrastructure to maintain

See **INTEGRATION.md** for detailed strategy.

## 🧪 Testing

### Health Check
```bash
curl http://localhost/health
```

### Load Distribution
```bash
for i in {1..30}; do
  curl -s http://localhost/api/workout-session | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['instance'])" &
done
wait
```

### Load Test with Apache Bench
```bash
ab -n 1000 -c 10 http://localhost/api/achievements
```

### Monitor Logs
```bash
docker logs -f fitbeat_load_balancer
docker logs -f fitbeat_replica_1
docker logs -f fitbeat_replica_2
docker logs -f fitbeat_replica_3
```

## 📈 Monitoring

Track these metrics before/after:
1. **Requests per second**: `ab -n 1000 -c 10`
2. **Response time**: `curl -w "Time: %{time_total}s"`
3. **CPU usage**: `docker stats`
4. **Availability**: Test with one replica stopped

## ⚡ Common Tasks

### Stop One Replica (Simulate Failure)
```bash
docker-compose -f docker-compose-scaling.yml stop replica_3
```

### Restart Stopped Replica
```bash
docker-compose -f docker-compose-scaling.yml start replica_3
```

### View All Containers
```bash
docker-compose -f docker-compose-scaling.yml ps
```

### Check Nginx Configuration
```bash
docker exec fitbeat_load_balancer nginx -T
```

### View Request Distribution in Real-Time
```bash
docker logs -f fitbeat_load_balancer | grep "GET /api"
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Requests failing | Check all replicas running: `docker ps` |
| Always hitting same replica | Verify correct algorithm loaded in Nginx |
| High latency | Monitor replica health: `docker stats` |
| Config not updating | Recreate load-balancer: `docker-compose up -d --no-deps load-balancer` |

## 📖 Additional Resources

- Lab 7 PDF (Laboratory 7.md) — Original source material
- [Nginx Documentation](https://nginx.org/en/docs/)
- [KrakenD Backends](https://www.krakend.io/docs/backends/)
- [Software Architecture Patterns](https://patterns.arcitura.com/)

## 🎓 Learning Outcomes

After working through this implementation, you'll understand:

1. ✓ How horizontal scaling improves performance & availability
2. ✓ Why statefulness is the barrier to scaling
3. ✓ How load balancers distribute traffic
4. ✓ Tradeoffs between different balancing algorithms
5. ✓ How to apply patterns to existing architectures
6. ✓ Observability practices for distributed systems

## 📋 Next Steps

1. **Understand the Pattern**: Read README.md thoroughly
2. **Experiment Locally**: Run the demo, switch algorithms, stop replicas
3. **Plan for FitBeat**: Review INTEGRATION.md, identify which services to scale first
4. **Implement**: Use EXAMPLES.md to update docker-compose.yml and krakend.json
5. **Test**: Verify improvements with load tests
6. **Monitor**: Track metrics in production

---

**Created**: May 26, 2026  
**Based on**: Laboratory 7 - Scalability (Software Architecture 2026-I)  
**Adapted for**: FitBeat Microservices Project  
**Status**: Ready for Production Implementation
