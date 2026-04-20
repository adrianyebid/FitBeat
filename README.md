# FitBeat

## Team
### Name
- 1e

### Team members
- Nicolas Felipe Arciniegas Lizarazo
- Karen Lorena Guzman Del Rio
- Juan David Chacon Muñoz
- Adrian Yebid Rincon
- Pablo Felipe Sandoval Menjura
- Julio Cesar Albadan Sarmiento 

## Software System
### Name
- Fitbeat

### Logo
![WhatsApp Image 2026-04-05 at 9 40 18 PM](https://github.com/user-attachments/assets/cfa66370-0594-4240-a5f4-f7bdf2c139c3)

### Description
- FitBeat es una plataforma fitness que sincroniza música de Spotify con el entrenamiento del usuario. El usuario selecciona su tipo de actividad (running, cycling, etc.) y sus preferencias musicales, y el sistema crea una sesión de entrenamiento que encola automáticamente tracks en su Spotify según esas preferencias. Durante el entrenamiento, el usuario controla la reproducción (play, pause, siguiente, anterior) en tiempo real a través de la plataforma.

## Architectural Structures
### C&C View
<img width="792" height="402" alt="C C1 drawio" src="https://github.com/user-attachments/assets/5bad796f-e880-4d00-a5b0-6aa675297bf2" />

### Description of architectural styles used
- Se utilizó una arquitectura de microservicios donde cada componente es independiente. El Componente A (FastAPI) gestiona autenticación e identidad, el Componente B (Go) gestiona sesiones de entrenamiento y reproducción, y el frontend (React) actúa como cliente. La comunicación entre componentes sigue el estilo REST para operaciones síncronas (login, creación de sesión, OAuth) y WebSocket para el control de reproducción en tiempo real. Cada servicio posee su propia base de datos (Database per Service): PostgreSQL para datos relacionales de usuarios y CouchDB para documentos de sesiones de entrenamiento, garantizando el aislamiento de datos entre microservicios. El despliegue está containerizado con Docker Compose, agrupando todos los servicios en una red interna compartida.

### Description of architectural elements and relations
- Frontend (React + Vite): Cliente web que renderiza la UI. Se comunica con el Componente A vía HTTP REST para autenticación y con el Componente B vía HTTP REST para crear sesiones y vía WebSocket para controlar la reproducción.

- Componente A — User Service (FastAPI): Gestiona registro, login, tokens JWT, OAuth con Spotify y almacenamiento de tokens Spotify por usuario. Expone una API REST consumida por el frontend.

- Componente B — Music Service (Go): Gestiona la creación de sesiones de entrenamiento, encola tracks en Spotify a través de su API, y mantiene un canal WebSocket con el frontend para recibir comandos de reproducción en tiempo real.

- PostgreSQL: Base de datos relacional del Componente A. Almacena usuarios, credenciales locales, tokens Spotify y sesiones de refresh JWT.

- CouchDB: Base de datos documental del Componente B. Almacena documentos de sesiones de entrenamiento (actividad, géneros, tracks encolados).

- Spotify API: Servicio externo. El Componente A gestiona su OAuth y el Componente B consume sus endpoints de búsqueda y control de cola de reproducción.

## Instructions for deploying the software system locally.

### Requisitos previos:
- Docker Desktop instalado y corriendo
- Cuenta Spotify Developer con una app creada

### Paso a paso:
1. Clonar el repositorio y configurar variables de entorno
Crear un archivo .env en la raíz del proyecto como esta en el archivo .env.example agregando las keys de spotify correspondientes a nuestra app; SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET

2. Levantar todos los servicios con el comando: docker-compose up --build

3. Verificar que todo esté corriendo docker-compose ps

### Flujo:
1. Abrir http://localhost:5173 (frontend web)
2. Registrarse o iniciar sesión
3. Completar la encuesta musical
4. Conectar cuenta Spotify desde el dashboard
5. Iniciar un entrenamiento y controlar la reproducción desde la plataforma
