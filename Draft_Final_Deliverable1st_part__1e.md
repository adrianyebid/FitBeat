# Software Architecture Final Deliverable

## Team
- **Name:** 1e
- **Members:** 
  - Nicolas Felipe Arciniegas Lizarazo
  - Karen Lorena Guzman Del Rio
  - Juan David Chacon Muñoz
  - Adrian Yebid Rincon
  - Pablo Felipe Sandoval Menjura
  - Julio Cesar Albadan Sarmiento

## Software System
- **Name:** FitBeat
- **Logo:**

![FitBeat Logo](https://github.com/user-attachments/assets/cfa66370-0594-4240-a5f4-f7bdf2c139c3)

- **Description:** FitBeat is a distributed fitness platform that synchronizes workout sessions with Spotify playback. A user can sign up or log in, connect a Spotify account, configure music preferences, and start a training session. During the session, playback can be controlled in real time, while business events are emitted and consumed asynchronously for achievements, analytics, and notifications.

## Architectural Structures

### Component-and Connector (C&C) Structure
#### C&C View
![C&C View](./images/c&c-view.jpg)

#### Description of architectural elements and relations
The system is divided into frontends (`web-ssr`, `cli`) acting as clients, and a backend ecosystem. Requests pass through `traefik` (Edge Proxy) and `krakend` (API Gateway). The logic is handled by microservices (`user-service`, `music-service`, `achievements-service`, `notification-service`, `event-processor`), which communicate synchronously via HTTP and asynchronously via `rabbitmq`. Data is persisted across dedicated databases (PostgreSQL, CouchDB).

#### Description of architectural styles and patterns used
- **Styles:** Microservices, Client-Server, Layered, Distributed.
- **Patterns:** API Gateway Pattern, Broker Pattern, Database-per-service, Repository Pattern.

---

### Deployment Structure
#### Deployment View
![Deployment View](./images/deployment-view.jpg)

#### Description of architectural elements and relations
Deployed using a Container-oriented model (Docker Compose). The network is strictly segmented into `gateway_network` (DMZ) for external access, `api_gateway_net` for internal APIs, isolated DB networks (`users_db_net`, etc.), and `messaging_net`. Containers isolate runtime environments for Python, Go, .NET 8, Node.js, and Java 21.

#### Description of architectural patterns used
- **Patterns:** Container-oriented deployment, Network Segmentation Pattern, Dedicated Storage Pattern, Two-Layer Gateway.

---

### Layered Structure
#### Layered View
![Layered View](./images/Layered-view.jpg)

#### Description of architectural elements and relations
- **Presentation:** Web (React/Next.js) and CLI frontends.
- **Entry & Communication:** Traefik, KrakenD, and RabbitMQ.
- **Domain Logic:** The 5 microservices implementing business rules.
- **Data:** PostgreSQL and CouchDB instances.

#### Description of architectural patterns used
- **Patterns:** N-Tier (4-tier) Architecture, Domain-oriented service layering, Broker-mediated asynchronous collaboration.

---

### Decomposition Structure
#### Decomposition View
![Decomposition View](./images/decomposition-view.jpg)

#### Description of architectural elements and relations
The system is functionally decomposed into business-aligned subsystems: Identity (Users), Workout (Music), Gamification (Achievements), Notifications, Async Processing (Events), Infrastructure (Gateways/Brokers), and External Integrations (Spotify API).

---

## Quality Attributes

### Security

#### Security scenarios
1. **Authentication (Confidentiality & Integrity):** When a user sends credentials to log in, data must travel encrypted through a secure channel so attackers cannot read or alter it in transit.
2. **API Protection (Gateway Bypass):** When an external attacker tries to access internal routes (e.g., `/auth/internal/token/{id}`), the system must reject it without revealing internal topology.
3. **Lateral Movement (S2S):** If a service or internal container is compromised, it cannot make unauthorized requests to other services without the correct cryptographic token.

#### Applied architectural tactics
- **Authenticate Users:** JWT for external clients; Shared Secret (`X-Internal-Token`) for S2S.
- **Authorize Actors:** KrakenD endpoint strict whitelisting.
- **Limit Access:** Docker network isolation separating the DMZ from internal APIs.
- **Encrypt Data:** TLS 1.2+ termination at Traefik with OpenSSL certificates.

#### Applied architectural patterns
- **Secure Channel Pattern:** TLS Offloading at the Reverse Proxy.
- **Reverse Proxy Pattern:** Hiding internal topology behind Traefik.
- **Network Segmentation Pattern:** DMZ vs Internal zones (Defense in Depth).
- **Secret Token (Shared Secret) Pattern:** Cryptographic validation for inter-service communication.

---

### Performance and Scalability

#### Performance scenarios
- **Real-time Playback Sync:** When 1,000 concurrent users are in active training sessions, the `music-service` must process WebSocket playback controls within 200ms latency to prevent UI lag.
- **Async Gamification:** When a high volume of workout events are generated globally, the `achievements-service` must process them asynchronously without affecting the responsiveness of the active training sessions.

#### Applied architectural tactics
- **Introduce Concurrency:** Utilizing Go routines in the `music-service` to handle thousands of concurrent WebSocket connections efficiently with minimal memory overhead.
- **Increase Resources (Horizontal Scaling):** Stateless microservices (`user-service`, `music-service`) are architected to be replicated across multiple containers or Kubernetes pods.
- **Asynchronous Processing:** Offloading heavy event processing, stat aggregation, and email dispatching to background queues (RabbitMQ).

#### Applied architectural patterns
- **Broker Pattern:** Decoupling fast producers (Music) from slower consumers (Achievements, Notifications) to handle traffic spikes gracefully.
- **Load Balancing Pattern:** Traefik and KrakenD distributing incoming HTTP/WS requests across backend replicas.

#### Performance testing analysis and results
*Note: The system has been architected to sustain high throughput via efficient runtimes (Go/FastAPI) and asynchronous queues. Initial local testing demonstrates 0 blocked threads during WebSocket broadcasting. Formal load testing (e.g., via JMeter or k6) is scheduled for the next phase to baseline the maximum concurrent WebSocket connections and RabbitMQ message throughput under peak synthetic loads.*
