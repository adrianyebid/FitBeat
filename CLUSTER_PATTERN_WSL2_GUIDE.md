# Cluster Pattern Implementation Guide for FitBeat (Windows con WSL2)

## ⚠️ IMPORTANTE: Requisito de Dos Máquinas Físicas

**Esta guía requiere DOS MÁQUINAS FÍSICAS WINDOWS** (como en el laboratorio original):
- **Máquina A (Windows)**: Control Plane con WSL2 + k3s server
- **Máquina B (Windows)**: Worker Node con WSL2 + k3s agent

Ambas máquinas deben estar en la **misma red local** y poder comunicarse entre sí.

## Tabla de Contenidos
1. [Introducción](#introducción)
2. [Prerrequisitos](#prerrequisitos)
3. [Configuración de WSL2](#configuración-de-wsl2)
4. [Instalación de k3s en WSL2](#instalación-de-k3s-en-wsl2)
5. [Configuración del Cluster Multi-Nodo](#configuración-del-cluster-multi-nodo)
6. [Componente de Referencia](#componente-de-referencia)
7. [Despliegue de Servicios FitBeat](#despliegue-de-servicios-fitbeat)
8. [Verificación de Patrones](#verificación-de-patrones)
9. [Simulación de Fallos](#simulación-de-fallos)
10. [Troubleshooting WSL2](#troubleshooting-wsl2)

---

## 1. Introducción

Esta guía adapta la implementación del **Cluster Pattern** del laboratorio para el proyecto **FitBeat** usando **WSL2 (Windows Subsystem for Linux 2)** con **k3s**, siguiendo fielmente las instrucciones originales del laboratorio pero adaptadas al entorno Windows.

### ¿Por qué WSL2 + k3s?

- **k3s nativo**: Ejecuta k3s exactamente como en el laboratorio original
- **Rendimiento**: WSL2 ofrece rendimiento casi nativo de Linux
- **Compatibilidad**: Comandos del laboratorio funcionan sin modificación
- **Multi-nodo real**: Usa dos máquinas físicas Windows, cada una con WSL2 + k3s

### Patrones Implementados

- **Replication**: 4 réplicas idénticas ejecutándose simultáneamente
- **Hot Spare**: Réplicas distribuidas entre nodos para tolerancia a fallos
- **Service Discovery**: Resolución DNS dentro del cluster
- **Internal Load Balancing**: Distribución automática de requests vía kube-proxy

---

## 2. Prerrequisitos

### Software Requerido (EN AMBAS MÁQUINAS)

- **Windows 10** (versión 2004+) o **Windows 11**
- **WSL2** instalado y configurado
- **Ubuntu 22.04 LTS** (o distribución Linux compatible)
- **Docker Desktop** (opcional, para construir imágenes en Máquina A)
- **Cuenta Docker Hub** (para publicar imágenes)

### Hardware Requerido (CADA MÁQUINA)

- Mínimo 8GB RAM (16GB recomendado)
- 30GB espacio libre en disco
- CPU con soporte de virtualización
- **Conexión a la misma red local** (ambas máquinas deben poder hacer ping entre sí)

---

## 3. Configuración de WSL2

**⚠️ REALIZAR EN AMBAS MÁQUINAS (A y B)**

### 3.1. Instalar WSL2

En **cada máquina Windows**, abre **PowerShell como Administrador** y ejecuta:

```powershell
# Instalar WSL2
wsl --install

# Reiniciar el sistema si es necesario
```

### 3.2. Instalar Ubuntu

```powershell
# Instalar Ubuntu 22.04
wsl --install -d Ubuntu-22.04

# Verificar instalación
wsl --list --verbose
```

Deberías ver:
```
  NAME            STATE           VERSION
* Ubuntu-22.04    Running         2
```

### 3.3. Configurar WSL2

Crea o edita el archivo `.wslconfig` en tu directorio home de Windows (`C:\Users\<tu-usuario>\.wslconfig`):

```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
localhostForwarding=true
```

Reinicia WSL2:
```powershell
wsl --shutdown
wsl
```

### 3.4. Actualizar Ubuntu

**⚠️ REALIZAR EN AMBAS MÁQUINAS**

Dentro de WSL2 (Ubuntu) en cada máquina:

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
sudo apt install -y curl wget git net-tools
```

---

## 4. Instalación de k3s en WSL2

**⚠️ IMPORTANTE: Sigue las instrucciones específicas para cada máquina**

### 4.1. Preparación del Sistema (AMBAS MÁQUINAS)

**Realizar en Máquina A y Máquina B:**

```bash
# Instalar dependencias
sudo apt install -y iptables

# Configurar systemd (necesario para k3s)
# Editar /etc/wsl.conf
sudo nano /etc/wsl.conf
```

Agregar:
```ini
[boot]
systemd=true
```

Salir de WSL y reiniciar:
```powershell
# En PowerShell
wsl --shutdown
wsl
```

### 4.2. Preparación de Red

**⚠️ CRÍTICO: Identificar IPs de ambas máquinas**

#### En Máquina A (Control Plane):

```bash
# Dentro de WSL2 en Máquina A
ip a | grep "inet " | grep -v 127.0.0.1
```

Anota la IP de WSL2 en Máquina A (ejemplo: `172.20.10.5`)

**También necesitas la IP de Windows de Máquina A:**
```powershell
# En PowerShell de Máquina A
ipconfig
```

Busca la IP de tu adaptador de red local (ejemplo: `192.168.1.100`)

#### En Máquina B (Worker Node):

```bash
# Dentro de WSL2 en Máquina B
ip a | grep "inet " | grep -v 127.0.0.1
```

Anota la IP de WSL2 en Máquina B (ejemplo: `172.20.10.6`)

**También necesitas la IP de Windows de Máquina B:**
```powershell
# En PowerShell de Máquina B
ipconfig
```

Busca la IP de tu adaptador de red local (ejemplo: `192.168.1.101`)

#### Tabla de IPs (Ejemplo):

| Máquina | Rol | IP Windows (Red Local) | IP WSL2 |
|---------|-----|------------------------|---------|
| Máquina A | Control Plane | 192.168.1.100 | 172.20.10.5 |
| Máquina B | Worker Node | 192.168.1.101 | 172.20.10.6 |

### 4.3. Verificar Conectividad Entre Máquinas

**Desde Máquina A (PowerShell):**
```powershell
ping 192.168.1.101
```

**Desde Máquina B (PowerShell):**
```powershell
ping 192.168.1.100
```

Ambos pings deben funcionar. Si no, verifica firewall y configuración de red.

### 4.4. Instalar k3s en Máquina A (Control Plane)

**⚠️ SOLO EN MÁQUINA A**

Dentro de WSL2 en Máquina A:

```bash
# Obtener IP de WSL2 en Máquina A
WSL_IP=$(hostname -I | awk '{print $1}')
echo "IP de WSL2 en Máquina A: $WSL_IP"

# Instalar k3s como servidor
# IMPORTANTE: Usa --tls-san con la IP de Windows de Máquina A para acceso desde Máquina B
curl -sfL https://get.k3s.io | sh -s - server \
  --node-ip $WSL_IP \
  --advertise-address $WSL_IP \
  --tls-san 192.168.1.100 \
  --write-kubeconfig-mode 644

# Verificar instalación
sudo systemctl status k3s

# Verificar nodo
sudo kubectl get nodes
```

Deberías ver:
```
NAME        STATUS   ROLES                  AGE   VERSION
<hostname>  Ready    control-plane,master   30s   v1.28.x+k3s1
```

### 4.5. Configurar kubectl en Máquina A

**En Máquina A (WSL2):**

```bash
# Copiar kubeconfig para uso sin sudo
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config

# Verificar acceso
kubectl get nodes
```

### 4.6. Obtener Token para Worker Node

**⚠️ IMPORTANTE: En Máquina A (WSL2)**

```bash
# Guardar token (necesario para Máquina B)
sudo cat /var/lib/rancher/k3s/server/node-token
```

**Copia este token completo**. Lo necesitarás en Máquina B. Ejemplo:
```
K10abc123def456ghi789jkl012mno345pqr678stu901vwx234yz::server:abc123def456
```

### 4.7. Configurar Port Forwarding en Windows (Máquina A)

**⚠️ CRÍTICO: Para que Máquina B pueda conectarse**

En **PowerShell como Administrador en Máquina A**:

```powershell
# Obtener IP de WSL2 en Máquina A
wsl hostname -I

# Configurar port forwarding del puerto 6443 (API de k3s)
# Reemplaza 172.20.10.5 con tu IP de WSL2 en Máquina A
netsh interface portproxy add v4tov4 listenport=6443 listenaddress=0.0.0.0 connectport=6443 connectaddress=172.20.10.5

# Verificar
netsh interface portproxy show all

# Configurar firewall para permitir puerto 6443
New-NetFirewallRule -DisplayName "k3s API Server" -Direction Inbound -LocalPort 6443 -Protocol TCP -Action Allow
```

### 4.8. Instalar k3s en Máquina B (Worker Node)

**⚠️ SOLO EN MÁQUINA B**

Dentro de WSL2 en Máquina B:

```bash
# Obtener IP de WSL2 en Máquina B
WSL_IP=$(hostname -I | awk '{print $1}')
echo "IP de WSL2 en Máquina B: $WSL_IP"

# Instalar k3s como agente (worker)
# Reemplaza:
# - 192.168.1.100 con la IP de Windows de Máquina A
# - <TOKEN> con el token obtenido de Máquina A
curl -sfL https://get.k3s.io | sh -s - agent \
  --server https://192.168.1.100:6443 \
  --token <TOKEN> \
  --node-ip $WSL_IP

# Verificar servicio
sudo systemctl status k3s-agent
```

**Ejemplo con valores reales:**
```bash
curl -sfL https://get.k3s.io | sh -s - agent \
  --server https://192.168.1.100:6443 \
  --token K10abc123def456ghi789jkl012mno345pqr678stu901vwx234yz::server:abc123def456 \
  --node-ip $(hostname -I | awk '{print $1}')
```

---

## 5. Verificación del Cluster Multi-Nodo

### 5.1. Verificar Cluster desde Máquina A

**En Máquina A (WSL2):**

```bash
# Verificar ambos nodos
kubectl get nodes -o wide
```

**Salida esperada:**
```
NAME              STATUS   ROLES                  AGE   VERSION   INTERNAL-IP    EXTERNAL-IP
maquina-a         Ready    control-plane,master   5m    v1.28.x   172.20.10.5    <none>
maquina-b         Ready    <none>                 2m    v1.28.x   172.20.10.6    <none>
```

Si el nodo de Máquina B no aparece o está en `NotReady`:
1. Verifica el token en Máquina B
2. Verifica el port forwarding en Máquina A
3. Verifica conectividad de red entre máquinas
4. Revisa logs: `sudo journalctl -u k3s-agent -f` en Máquina B

### 5.2. Verificar Conectividad Entre Nodos

**⚠️ IMPORTANTE: WSL2 usa NAT**

Las IPs internas de WSL2 (como 172.20.10.x) **NO son directamente accesibles** entre diferentes máquinas físicas. Por eso configuramos port forwarding en el paso 4.7.

**Verificación correcta desde WSL2 de Máquina A:**

```bash
# Hacer ping a la IP de WINDOWS de Máquina B (no a WSL2)
ping 192.168.1.101
```

**Verificación correcta desde WSL2 de Máquina B:**

```bash
# Hacer ping a la IP de WINDOWS de Máquina A (no a WSL2)
ping 192.168.1.100

# Verificar conectividad al API server de k3s (a través de port forwarding)
curl -k https://192.168.1.100:6443/ping
```

**Resultado esperado:**
- Los pings a las IPs de Windows deben funcionar
- El curl debe devolver "pong" o un error de autenticación (ambos indican que el puerto está accesible)

Si los pings no funcionan:
- Verifica firewall de Windows en ambas máquinas
- Verifica que ambas máquinas estén en la misma red física
- Asegúrate de haber configurado el port forwarding (paso 4.7)

---

## 6. Componente de Referencia

### 6.1. Estructura del Componente

Dentro de WSL2, navega a tu proyecto FitBeat:

```bash
# Navegar al proyecto (ajusta la ruta según tu configuración)
cd /mnt/c/Users/<tu-usuario>/Documents/uni/FitBeat

# Crear estructura
mkdir -p kubernetes/reference-component/app
cd kubernetes/reference-component
```

### 6.2. Crear Componente de Referencia

**Archivo: `app/main.py`**

```python
from fastapi import FastAPI
import socket
import os

app = FastAPI()

@app.get("/")
def read_root():
    return {
        "message": "Hello from FitBeat cluster!",
        "host": socket.gethostname(),
        "instance_id": os.getenv("INSTANCE_ID", "unknown")
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "host": socket.gethostname()}
```

**Archivo: `requirements.txt`**

```
fastapi==0.104.1
uvicorn==0.24.0
```

**Archivo: `Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 6.3. Construir y Publicar Imagen

```bash
# Construir imagen
docker build -t <tu-usuario-dockerhub>/fitbeat-reference:latest .

# Login a Docker Hub
docker login

# Publicar imagen
docker push <tu-usuario-dockerhub>/fitbeat-reference:latest
```

**Nota**: Si Docker Desktop está instalado en Windows, puedes construir desde Windows y usar la imagen en WSL2.

### 6.4. Manifiestos Kubernetes

**Archivo: `deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: component-deployment
  # Replication: 4 instancias idénticas ejecutándose simultáneamente
  # Todas están "hot", ninguna es primaria o standby
spec:
  replicas: 4
  selector:
    matchLabels:
      app: reliability-component
  template:
    metadata:
      labels:
        app: reliability-component
    spec:
      affinity:
        podAntiAffinity:
          # Fomentar que los pods se distribuyan en diferentes nodos (Hot Spare)
          # 'preferred' no bloquea el scheduling si solo hay un nodo disponible
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values: ["reliability-component"]
              topologyKey: "kubernetes.io/hostname"
      containers:
      - name: component
        image: <tu-usuario-dockerhub>/fitbeat-reference:latest
        ports:
        - containerPort: 8000
        env:
        - name: INSTANCE_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
```

**Archivo: `service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: component-service
  # Service Discovery: este nombre se resuelve dentro del cluster como
  # component-service.default.svc.cluster.local
  # Internal Load Balancer: kube-proxy distribuye requests entre todos
  # los pods que coinciden con el selector, usando round-robin
spec:
  type: NodePort
  selector:
    app: reliability-component
  ports:
  - port: 80
    targetPort: 8000
    nodePort: 30080
```

### 6.5. Desplegar Componente de Referencia

```bash
# Aplicar manifiestos
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Verificar despliegue
kubectl get deployments
kubectl get pods -o wide
kubectl get services
```

---

## 7. Despliegue de Servicios FitBeat

### 7.1. Preparar Imágenes de FitBeat

Desde Windows (PowerShell) o WSL2:

```bash
# Navegar al proyecto
cd /mnt/c/Users/<tu-usuario>/Documents/uni/FitBeat

# User Service
docker build -t <tu-usuario>/fitbeat-user-service:latest ./backend/user-service
docker push <tu-usuario>/fitbeat-user-service:latest

# Music Service
docker build -t <tu-usuario>/fitbeat-music-service:latest ./backend/music-service
docker push <tu-usuario>/fitbeat-music-service:latest

# Achievements Service
docker build -t <tu-usuario>/fitbeat-achievements-service:latest ./backend/achievements-service
docker push <tu-usuario>/fitbeat-achievements-service:latest

# Notification Service
docker build -t <tu-usuario>/fitbeat-notification-service:latest ./backend/notification-service
docker push <tu-usuario>/fitbeat-notification-service:latest
```

### 7.2. Crear Namespace

```bash
kubectl create namespace fitbeat
kubectl config set-context --current --namespace=fitbeat
```

### 7.3. Infraestructura Base

**Archivo: `kubernetes/infrastructure.yaml`**

```yaml
# PostgreSQL para User Service
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: fitbeat
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          value: "postgres"
        - name: POSTGRES_DB
          value: "fitbeat_users"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: fitbeat
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
  - port: 5432
---
# Redis Cache
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: fitbeat
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command: ["redis-server", "--appendonly", "yes"]
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: fitbeat
spec:
  selector:
    app: redis
  ports:
  - port: 6379
---
# RabbitMQ
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: fitbeat
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3.13-management
        ports:
        - containerPort: 5672
        - containerPort: 15672
---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq-service
  namespace: fitbeat
spec:
  selector:
    app: rabbitmq
  ports:
  - port: 5672
    name: amqp
  - port: 15672
    name: management
---
# CouchDB
apiVersion: apps/v1
kind: Deployment
metadata:
  name: couchdb
  namespace: fitbeat
spec:
  replicas: 1
  selector:
    matchLabels:
      app: couchdb
  template:
    metadata:
      labels:
        app: couchdb
    spec:
      containers:
      - name: couchdb
        image: couchdb:3
        ports:
        - containerPort: 5984
        env:
        - name: COUCHDB_USER
          value: "admin"
        - name: COUCHDB_PASSWORD
          value: "secret"
---
apiVersion: v1
kind: Service
metadata:
  name: couchdb-service
  namespace: fitbeat
spec:
  selector:
    app: couchdb
  ports:
  - port: 5984
```

**Desplegar infraestructura (SOLO desde Máquina A):**

```bash
# En WSL2 de Máquina A
kubectl apply -f kubernetes/infrastructure.yaml

# Esperar a que estén listos
kubectl wait --for=condition=ready pod -l app=postgres --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis --timeout=120s
kubectl wait --for=condition=ready pod -l app=rabbitmq --timeout=120s
```

**Nota**: Todos los comandos `kubectl` se ejecutan desde **Máquina A** únicamente, ya que es donde está configurado el control plane.

### 7.4. User Service

**Archivo: `kubernetes/user-service.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: fitbeat
spec:
  replicas: 4
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values: ["user-service"]
              topologyKey: "kubernetes.io/hostname"
      containers:
      - name: user-service
        image: <tu-usuario>/fitbeat-user-service:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          value: "postgresql://postgres:postgres@postgres-service:5432/fitbeat_users"
        - name: REDIS_URL
          value: "redis://redis-service:6379/0"
        - name: INSTANCE_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: fitbeat
spec:
  type: NodePort
  selector:
    app: user-service
  ports:
  - port: 8000
    targetPort: 8000
    nodePort: 30081
```

**Desplegar:**

```bash
kubectl apply -f kubernetes/user-service.yaml
kubectl get pods -o wide -l app=user-service
```

### 7.5. Music Service

**Archivo: `kubernetes/music-service.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: music-service
  namespace: fitbeat
spec:
  replicas: 4
  selector:
    matchLabels:
      app: music-service
  template:
    metadata:
      labels:
        app: music-service
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values: ["music-service"]
              topologyKey: "kubernetes.io/hostname"
      containers:
      - name: music-service
        image: <tu-usuario>/fitbeat-music-service:latest
        ports:
        - containerPort: 8081
        env:
        - name: PORT
          value: "8081"
        - name: COUCHDB_ADDR
          value: "admin:secret@couchdb-service:5984"
        - name: RABBITMQ_URL
          value: "amqp://guest:guest@rabbitmq-service:5672/"
        - name: INSTANCE_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
---
apiVersion: v1
kind: Service
metadata:
  name: music-service
  namespace: fitbeat
spec:
  type: NodePort
  selector:
    app: music-service
  ports:
  - port: 8081
    targetPort: 8081
    nodePort: 30082
```

**Desplegar (desde Máquina A):**

```bash
# En WSL2 de Máquina A
kubectl apply -f kubernetes/music-service.yaml
```

### 7.6. Verificar Todos los Servicios

**⚠️ Ejecutar desde Máquina A (WSL2):**

```bash
# Ver todos los pods y en qué nodo están
kubectl get pods -o wide -n fitbeat

# Deberías ver pods distribuidos entre maquina-a y maquina-b
# Ejemplo:
# NAME                    READY   STATUS    NODE
# user-service-xxx        1/1     Running   maquina-a
# user-service-yyy        1/1     Running   maquina-b
# user-service-zzz        1/1     Running   maquina-a
# user-service-www        1/1     Running   maquina-b

# Ver servicios
kubectl get services -n fitbeat

# Ver endpoints (IPs de los pods)
kubectl get endpoints -n fitbeat
```

---

## 8. Verificación de Patrones

### 8.1. Verificar Load Balancer

**Opción A: Desde Máquina A (WSL2):**

```bash
# En WSL2 de Máquina A
WSL_IP=$(hostname -I | awk '{print $1}')

# Enviar 10 requests
for i in $(seq 1 10); do
  curl -s http://$WSL_IP:30080 | python3 -c "import sys, json; print(json.load(sys.stdin)['host'])"
  echo "---"
done
```

**Opción B: Desde Windows (Máquina A o B):**

```powershell
# En PowerShell de cualquier máquina
# Usa la IP de Windows de Máquina A
for ($i=1; $i -le 10; $i++) {
    curl http://192.168.1.100:30080 | ConvertFrom-Json | Select-Object host
}
```

Deberías ver diferentes hostnames de pods, confirmando el load balancing entre ambos nodos.

### 8.2. Verificar Service Discovery

**Desde Máquina A (WSL2):**

```bash
# Desplegar pod de debug
kubectl run debug --image=busybox --restart=Never -n fitbeat -- sleep 300

# Ejecutar nslookup
kubectl exec debug -n fitbeat -- nslookup component-service

# También probar con servicios FitBeat
kubectl exec debug -n fitbeat -- nslookup user-service
kubectl exec debug -n fitbeat -- nslookup music-service

# Limpiar
kubectl delete pod debug -n fitbeat
```

Salida esperada:
```
Server: 10.43.0.10
Address 1: 10.43.0.10 kube-dns.kube-system.svc.cluster.local

Name: component-service
Address 1: 10.43.x.x component-service.default.svc.cluster.local
```

### 8.3. Verificar Replicación

**Desde Máquina A (WSL2):**

```bash
# Obtener pods actuales y ver en qué nodo están
kubectl get pods -o wide -n fitbeat

# Eliminar un pod que esté en Máquina B
kubectl delete pod <nombre-del-pod-en-maquina-b> -n fitbeat

# Observar recreación automática
kubectl get pods -n fitbeat -w
```

El ReplicaSet controller creará inmediatamente un reemplazo, posiblemente en el mismo nodo o en el otro.

### 8.4. Verificar Distribución de Pods Entre Nodos Físicos

**Desde Máquina A (WSL2):**

```bash
# Ver distribución entre maquina-a y maquina-b
kubectl get pods -o wide -n fitbeat | grep user-service

# Contar pods por nodo
echo "Pods en Máquina A:"
kubectl get pods -n fitbeat -o wide | grep maquina-a | wc -l

echo "Pods en Máquina B:"
kubectl get pods -n fitbeat -o wide | grep maquina-b | wc -l
```

Deberías ver pods distribuidos entre ambas máquinas físicas gracias al pod anti-affinity.

---

## 9. Simulación de Fallos

### 9.1. Fallo de Pod (Patrón de Replicación)

**⚠️ Ejecutar desde Máquina A**

**Terminal 1 - En Máquina A (WSL2), observar pods:**
```bash
kubectl get pods -o wide -n fitbeat -w
```

**Terminal 2 - En Máquina A (WSL2), eliminar pod:**
```bash
# Ver pods y sus nodos
kubectl get pods -o wide -n fitbeat | grep user-service

# Eliminar un pod específico (puede estar en cualquier nodo)
kubectl delete pod <nombre-pod-user-service> -n fitbeat
```

**Observar en Terminal 1:**
1. Pod entra en estado `Terminating`
2. Nuevo pod se crea inmediatamente por el ReplicaSet
3. Nuevo pod alcanza estado `Running` en segundos
4. El servicio continúa operando (otras 3 réplicas manejan el tráfico)

**Verificar que el servicio sigue funcionando:**
```bash
# En Máquina A (WSL2)
for i in $(seq 1 5); do
  curl -s http://$(hostname -I | awk '{print $1}'):30081/health | grep status
  sleep 1
done
```

### 9.2. Fallo de Nodo Físico (Patrón Hot Spare) ⭐

**⚠️ ESTA ES LA SIMULACIÓN CLAVE DEL LABORATORIO**

Esta simulación demuestra el patrón Hot Spare usando dos máquinas físicas reales.

**Terminal 1 - En Máquina A (WSL2), observar pods:**
```bash
kubectl get pods -o wide -n fitbeat -w
```

Nota los pods que están corriendo en `maquina-b`.

**Terminal 2 - En Máquina B, simular fallo del nodo:**

**Opción 1: Detener k3s-agent (simulación limpia):**
```bash
# En WSL2 de Máquina B
sudo systemctl stop k3s-agent
```

**Opción 2: Apagar WSL2 completamente (simulación de fallo de máquina):**
```powershell
# En PowerShell de Máquina B
wsl --shutdown
```

**Opción 3: Desconectar red de Máquina B (simulación de fallo de red):**
```powershell
# En PowerShell de Máquina B (como Administrador)
# Desactivar adaptador de red temporalmente
Disable-NetAdapter -Name "Ethernet" -Confirm:$false
# O el nombre de tu adaptador (usa Get-NetAdapter para ver nombres)
```

**Observar en Terminal 1 (Máquina A):**

```
Tiempo 0s: Pods corriendo normalmente en ambos nodos
Tiempo ~40s: Máquina B se marca como NotReady
Tiempo ~45s: Pods en Máquina B entran en Terminating
Tiempo ~50s: Nuevos pods se crean en Máquina A
Tiempo ~60s: Nuevos pods alcanzan Running en Máquina A
```

**Verificar estado del cluster:**
```bash
# En Máquina A (WSL2)
kubectl get nodes

# Deberías ver:
# NAME        STATUS     ROLES                  AGE
# maquina-a   Ready      control-plane,master   30m
# maquina-b   NotReady   <none>                 25m

# Ver distribución de pods
kubectl get pods -o wide -n fitbeat

# Todos los pods ahora deberían estar en maquina-a
```

**Verificar que el servicio sigue funcionando:**
```bash
# En Máquina A (WSL2)
# El servicio debe seguir respondiendo con las réplicas en Máquina A
for i in $(seq 1 10); do
  curl -s http://$(hostname -I | awk '{print $1}'):30081/health
  sleep 1
done
```

**Restaurar Máquina B:**

**Si usaste Opción 1:**
```bash
# En WSL2 de Máquina B
sudo systemctl start k3s-agent

# Verificar
sudo systemctl status k3s-agent
```

**Si usaste Opción 2:**
```powershell
# En PowerShell de Máquina B
wsl

# Dentro de WSL2
sudo systemctl status k3s-agent
# Si no está corriendo:
sudo systemctl start k3s-agent
```

**Si usaste Opción 3:**
```powershell
# En PowerShell de Máquina B (como Administrador)
Enable-NetAdapter -Name "Ethernet"
```

**Verificar recuperación en Máquina A:**
```bash
# En Máquina A (WSL2)
kubectl get nodes

# Esperar a que maquina-b vuelva a Ready
# Después de ~1 minuto:
# NAME        STATUS   ROLES                  AGE
# maquina-a   Ready    control-plane,master   35m
# maquina-b   Ready    <none>                 30m

# Kubernetes rebalanceará los pods automáticamente
kubectl get pods -o wide -n fitbeat -w
```

### 9.3. Registrar Secuencia de Recuperación

**Desde Máquina A (WSL2):**

```bash
# Obtener eventos después de la simulación
kubectl get events -n fitbeat \
  --sort-by='.lastTimestamp' \
  --field-selector involvedObject.name=user-service

# Ver eventos detallados del deployment
kubectl describe deployment user-service -n fitbeat

# Ver eventos del nodo que falló
kubectl describe node maquina-b

# Exportar timeline completo
kubectl get events -n fitbeat --sort-by='.lastTimestamp' > recovery-timeline.txt
```

**Métricas clave a documentar:**
- Tiempo desde fallo hasta detección (NotReady): ~40 segundos
- Tiempo desde detección hasta terminación de pods: ~5 segundos
- Tiempo desde terminación hasta nuevos pods Running: ~10-15 segundos
- **Tiempo total de recuperación**: ~60 segundos
- **Disponibilidad del servicio**: 100% (réplicas en Máquina A continuaron operando)

---

## 10. Troubleshooting WSL2

### 10.1. Problemas Comunes de WSL2

#### WSL2 no inicia
```powershell
# Reiniciar WSL
wsl --shutdown
wsl

# Verificar versión
wsl --list --verbose
```

#### systemd no funciona
```bash
# Verificar configuración
cat /etc/wsl.conf

# Debe contener:
# [boot]
# systemd=true

# Reiniciar WSL desde PowerShell
wsl --shutdown
```

#### k3s no inicia
```bash
# Verificar logs
sudo journalctl -u k3s -f

# Verificar estado
sudo systemctl status k3s

# Reiniciar servicio
sudo systemctl restart k3s
```

### 10.2. Problemas de Red

#### No se puede acceder a NodePort desde Windows

```bash
# Obtener IP de WSL2
hostname -I

# Verificar que el servicio esté escuchando
sudo netstat -tlnp | grep 30080
```

Acceder desde Windows usando la IP de WSL2:
```
http://<WSL2-IP>:30080
```

#### Pods no pueden comunicarse

```bash
# Verificar iptables
sudo iptables -L -n

# Verificar CNI
kubectl get pods -n kube-system

# Reiniciar k3s si es necesario
sudo systemctl restart k3s
```

### 10.3. Problemas de Almacenamiento

#### PersistentVolume no se crea

```bash
# Verificar storage class
kubectl get storageclass

# k3s usa local-path por defecto
kubectl get pv
kubectl get pvc -n fitbeat
```

### 10.4. Problemas de Memoria

```bash
# Verificar uso de memoria
free -h

# Ver uso por pods
kubectl top pods -n fitbeat

# Ajustar límites en .wslconfig (Windows)
# C:\Users\<usuario>\.wslconfig
```

### 10.5. Acceso desde Windows

#### Port Forwarding

```bash
# Hacer port forward de un servicio
kubectl port-forward -n fitbeat service/user-service 8000:8000

# Acceder desde Windows
# http://localhost:8000
```

#### Exponer con LoadBalancer (usando MetalLB)

```bash
# Instalar MetalLB
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.12/config/manifests/metallb-native.yaml

# Configurar pool de IPs
# Crear metallb-config.yaml con tu rango de IPs WSL2
```

### 10.6. Comandos Útiles de Diagnóstico

```bash
# Ver logs de un pod
kubectl logs <pod-name> -n fitbeat

# Ver logs de todos los pods de un servicio
kubectl logs -l app=user-service -n fitbeat --tail=50

# Ejecutar comando en un pod
kubectl exec -it <pod-name> -n fitbeat -- /bin/sh

# Ver eventos del cluster
kubectl get events -n fitbeat --sort-by='.lastTimestamp'

# Ver uso de recursos
kubectl top nodes
kubectl top pods -n fitbeat

# Describir un recurso
kubectl describe pod <pod-name> -n fitbeat
kubectl describe service user-service -n fitbeat
```

### 10.7. Reinicio Completo

Si todo falla:

```bash
# Desinstalar k3s
/usr/local/bin/k3s-uninstall.sh

# Limpiar
sudo rm -rf /var/lib/rancher/k3s
sudo rm -rf /etc/rancher/k3s

# Reinstalar
curl -sfL https://get.k3s.io | sh -s - server \
  --node-ip $(hostname -I | awk '{print $1}') \
  --advertise-address $(hostname -I | awk '{print $1}')
```

### 10.8. Acceso a Docker desde WSL2

Si Docker Desktop está instalado:

```bash
# Verificar acceso a Docker
docker ps

# Si no funciona, habilitar integración WSL2 en Docker Desktop:
# Settings > Resources > WSL Integration > Enable for Ubuntu-22.04
```

---

## Resumen

Esta guía ha adaptado el Cluster Pattern del laboratorio para FitBeat en Windows usando WSL2:

### Ventajas de WSL2 + k3s

✅ **Comandos nativos**: Todos los comandos del laboratorio funcionan sin modificación
✅ **k3s real**: Ejecutas k3s exactamente como en Linux
✅ **Multi-nodo**: Posible simular múltiples nodos con múltiples instancias WSL2
✅ **Rendimiento**: Casi nativo de Linux
✅ **Aprendizaje**: Experiencia más cercana a entornos de producción

### Patrones Implementados

| Patrón | Implementación |
|--------|----------------|
| **Replication** | 4 réplicas por servicio |
| **Hot Spare** | Pod anti-affinity para distribución entre nodos |
| **Service Discovery** | DNS interno de Kubernetes (ClusterIP) |
| **Internal Load Balancing** | kube-proxy con round-robin |

### Diferencias con el Laboratorio Original

| Laboratorio Original | Adaptación WSL2 |
|---------------------|-----------------|
| Máquinas físicas/VMs | Instancias WSL2 |
| `ip a` directo | `hostname -I` en WSL2 |
| Acceso directo a puertos | Usar IP de WSL2 desde Windows |
| systemctl nativo | systemctl en WSL2 con systemd habilitado |

### Próximos Pasos

1. ✅ Instalar y configurar WSL2
2. ✅ Instalar k3s en WSL2
3. ✅ (Opcional) Configurar multi-nodo con múltiples instancias WSL2
4. ✅ Desplegar componente de referencia
5. ✅ Desplegar servicios FitBeat
6. ✅ Verificar patrones (replicación, service discovery, load balancing)
7. ✅ Ejecutar simulaciones de fallos
8. ✅ Documentar observaciones y tiempos de recuperación

### Evidencia del Patrón

Captura evidencia de:
- Distribución de pods entre nodos (`kubectl get pods -o wide`)
- Endpoints del servicio (`kubectl get endpoints`)
- Load balancing en acción (múltiples curl mostrando diferentes hosts)
- Recuperación automática después de eliminar un pod
- Timeline de recuperación ante fallo de nodo

Esta evidencia demuestra la implementación del Cluster Pattern en tu arquitectura FitBeat.