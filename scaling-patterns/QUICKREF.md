# Quick Reference Guide

## 📊 Architecture Comparison

### BEFORE (Single Instance)
```
Client Request → Nginx LB → Service (Single) → Database
                              ↓
                         Processing
                         (100 req/sec max)
```

**Limitations:**
- Single service handles all requests
- No fault tolerance
- Unused CPU on low-traffic days
- Bottleneck at ~100 req/sec

---

### AFTER (Horizontal Scaling)
```
Client Request → Nginx LB ─┬─ Replica 1 ──┐
                           ├─ Replica 2 ──┼─→ Shared Database
                           └─ Replica 3 ──┘

Multiple instances handle requests in parallel
(~300 req/sec total, ~100 per instance)
```

**Advantages:**
- Distributed processing
- Fault tolerant (2/3 survive any 1 failure)
- Better CPU utilization
- ~3× throughput improvement

---

## 🎯 Load Balancing Algorithms at a Glance

### Round Robin (Recommended Default)
```
Request 1 → Replica 1
Request 2 → Replica 2
Request 3 → Replica 3
Request 4 → Replica 1 (cycle repeats)
```
**Use when:** Requests have similar processing time  
**Nginx:** No directive needed (default)

### Least Connections (For Variable Workloads)
```
Replica 1: 5 active connections
Replica 2: 2 active connections ← New request goes here
Replica 3: 4 active connections
```
**Use when:** Some requests take longer than others  
**Nginx:** `least_conn;` directive

### IP Hash (Sticky Sessions)
```
Client IP: 192.168.1.100 → Hash → Always Replica 2
Client IP: 192.168.1.101 → Hash → Always Replica 1
```
**Use when:** Client needs affinity (rare)  
**Nginx:** `ip_hash;` directive

---

## 🚀 Command Reference

### Start Demo
```bash
cd scaling-patterns
docker-compose -f docker-compose-scaling.yml up --build -d
```

### Test Distribution (9 Requests)
```bash
for i in {1..9}; do
  curl -s http://localhost/api/workout-session | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['instance'])"
done
```

### Switch Algorithm
```bash
# Edit docker-compose-scaling.yml:
# Change: ./nginx/nginx.round-robin.conf
# To:     ./nginx/nginx.least-conn.conf  OR  ./nginx/nginx.ip-hash.conf

# Recreate load balancer only
docker-compose -f docker-compose-scaling.yml up -d --no-deps load-balancer
```

### Stop One Replica (Simulate Failure)
```bash
docker-compose -f docker-compose-scaling.yml stop replica_3
```

### Monitor Live
```bash
docker logs -f fitbeat_load_balancer
docker stats --no-stream
```

### Load Test
```bash
ab -n 1000 -c 10 http://localhost/api/achievements
```

---

## 📂 File Purpose

| File | Purpose | Edit? |
|------|---------|-------|
| `app.py` | Demo service (responds with instance ID) | No |
| `Dockerfile` | Container image for app | No |
| `nginx.round-robin.conf` | Load balancer config #1 | No, reference only |
| `nginx.least-conn.conf` | Load balancer config #2 | No, reference only |
| `nginx.ip-hash.conf` | Load balancer config #3 | No, reference only |
| `docker-compose-scaling.yml` | Orchestration file | **YES** (to switch LB algorithm) |
| `README.md` | Complete guide with examples | Reference |
| `INTEGRATION.md` | How to apply to FitBeat | Reference |
| `EXAMPLES.md` | Copy-paste config for services | Copy snippets |
| `SUMMARY.md` | Overview (this folder) | Reference |

---

## 🔍 Testing Checklist

- [ ] Start system: `docker-compose -f docker-compose-scaling.yml up --build -d`
- [ ] Verify all running: `docker-compose -f docker-compose-scaling.yml ps` (4 containers)
- [ ] Test single request: `curl http://localhost/api/stats`
- [ ] Test distribution (9 requests): `for i in {1..9}; do ... done`
- [ ] Test failure: `docker-compose stop replica_3`
- [ ] Verify still working with 2 replicas
- [ ] Restart: `docker-compose start replica_3`
- [ ] Switch algorithm: Edit docker-compose-scaling.yml, recreate LB
- [ ] Load test: `ab -n 1000 -c 10 http://localhost/api/achievements`
- [ ] Monitor logs: `docker logs -f fitbeat_load_balancer`

---

## 🎓 Key Takeaways

| Concept | Explanation |
|---------|-------------|
| **Horizontal Scaling** | Add more instances instead of bigger hardware |
| **Statelessness** | Don't store session data in memory; use DB instead |
| **Load Balancing** | Distribute requests across replicas |
| **Instance ID** | Include in responses for observability |
| **Fault Tolerance** | 1 replica failure ≠ total outage |
| **Performance Gain** | N replicas ≈ N× throughput |

---

## 🔄 Apply to FitBeat

### Strategy (from INTEGRATION.md)

1. **Option A: KrakenD-based** (easiest)
   - Update KrakenD config to route to multiple replicas
   - No new infrastructure
   - Use `balancing_strategy: "round_robin"`

2. **Option B: Nginx-based** (more control)
   - Add Nginx load balancers per service
   - More setup, more flexibility
   - Choose any algorithm per service

### Services to Scale (All Stateless ✓)

- `user-service` → scale to 3 replicas
- `music-service` → scale to 3 replicas
- `achievements-service` → scale to 2-3 replicas
- `notification-service` → scale to 2 replicas
- `event-processor` → scale to 2 replicas (RabbitMQ distributes automatically)

### Implementation Steps

1. Backup current configs:
   ```bash
   cp docker-compose.yml docker-compose.yml.backup
   cp krakend/krakend.json krakend/krakend.json.backup
   ```

2. Update docker-compose.yml:
   - Replace each service with `_1`, `_2`, `_3` replicas
   - Use EXAMPLES.md for copy-paste configs

3. Update krakend.json:
   - Change single `"host": ["service"]`
   - To: `"host": ["service_1", "service_2", "service_3"]`
   - Add: `"balancing_strategy": "round_robin"`

4. Test:
   ```bash
   docker-compose up -d --build
   docker-compose ps
   ```

5. Load test and compare metrics

---

## 📊 Performance Metrics

### Measure Before Scaling
```bash
# Baseline
ab -n 1000 -c 10 -r http://localhost:8090/api/auth/me > baseline.txt
# Record: Requests/sec, Time/request, Failed requests
```

### Measure After Scaling
```bash
# With 3 replicas
ab -n 1000 -c 10 -r http://localhost:8090/api/auth/me > scaled.txt
# Compare improvements
```

### Expected Improvements
- Requests/sec: 3×
- Response time: ~same or better
- Failed requests: 0 (better reliability)

---

## ⚠️ Common Mistakes

| Mistake | Impact | Solution |
|---------|--------|----------|
| Scaling stateful service | Won't work (race conditions) | Ensure service is stateless |
| Not updating KrakenD config | Requests only hit one replica | Update `host` array in krakend.json |
| Forgetting depends_on | Services may start in wrong order | Update `depends_on` in docker-compose |
| Same port for all replicas | Container conflicts | Use internal port (e.g., 8081 for all) |

---

## 🆘 If Something Breaks

```bash
# Check what's running
docker-compose ps

# Read logs
docker logs fb_api_gateway
docker logs fitbeat_load_balancer
docker logs fitbeat_replica_1

# Restart everything
docker-compose down
docker-compose up -d

# Revert changes
cp docker-compose.yml.backup docker-compose.yml
docker-compose up -d
```

---

## 📞 Quick Links Within This Folder

- **Getting Started**: Read `README.md` → "Quick Start" section
- **Understanding Algorithms**: Read `README.md` → "Load Balancing Algorithms Comparison"
- **Apply to FitBeat**: Read `INTEGRATION.md` → Choose Option A or B
- **Copy Config for Services**: See `EXAMPLES.md` → Find your service
- **Full Overview**: Read `SUMMARY.md`

---

## 🎯 Next Action

1. **If exploring the pattern:**
   ```bash
   cd scaling-patterns
   docker-compose -f docker-compose-scaling.yml up --build -d
   # Follow "Quick Start" in README.md
   ```

2. **If applying to FitBeat:**
   - Read INTEGRATION.md
   - Read EXAMPLES.md
   - Update docker-compose.yml (your main one, not this demo)
   - Update krakend/krakend.json

3. **If troubleshooting:**
   - Check docker ps & logs
   - Verify krakend.json syntax
   - Test endpoint directly: `curl http://localhost:8085/api/...`

---

**Happy Scaling! 🚀**

Questions? Check README.md or INTEGRATION.md sections.
