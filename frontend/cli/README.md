# GymBeat CLI

Aplicación de línea de comandos para GymBeat - Entrena con ritmo, supera tus límites.

## 📋 Descripción

GymBeat CLI es una interfaz de terminal completa que replica la funcionalidad de la aplicación web, permitiendo a los usuarios:

- Autenticarse (iniciar sesión o registrarse)
- Conectar su cuenta de Spotify
- Iniciar sesiones de entrenamiento
- Controlar la reproducción de música en tiempo real
- Gestionar diferentes tipos de entrenamiento

## 🚀 Instalación

### Requisitos previos

- Node.js 18+ 
- npm o yarn
- Cuenta de Spotify Premium (requerida para control de reproducción)
- Servicios backend de GymBeat ejecutándose:
  - User Service (puerto 8000)
  - Music Service (puerto 8081)

### Pasos de instalación

1. Navega al directorio del CLI:
```bash
cd frontend/cli
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env
```

Edita `.env` si necesitas cambiar las URLs de los servicios:
```env
AUTH_API_URL=http://localhost:8000
MUSIC_API_URL=http://localhost:8081
WS_API_URL=ws://localhost:8081
CLI_DEBUG=false
```

## 🎯 Uso

### Iniciar la aplicación

```bash
npm start
```

O si tienes Node.js 18+ con soporte para `--watch`:
```bash
npm run dev
```

### Flujo de usuario

#### 1. Autenticación

Al iniciar, se te presentará un menú para:
- **Iniciar sesión**: Si ya tienes una cuenta
- **Registrarse**: Para crear una nueva cuenta
- **Salir**: Para cerrar la aplicación

**Registro:**
- Nombre
- Apellido
- Correo electrónico
- Contraseña (mínimo 6 caracteres)

**Inicio de sesión:**
- Correo electrónico
- Contraseña

#### 2. Dashboard

Después de autenticarte, accederás al menú principal donde puedes:
- **Comenzar entrenamiento**: Inicia una sesión (requiere Spotify conectado)
- **Conectar Spotify**: Autoriza tu cuenta de Spotify
- **Cerrar sesión**: Vuelve a la pantalla de autenticación
- **Salir**: Cierra la aplicación

#### 3. Conexión con Spotify

Para usar GymBeat necesitas conectar tu cuenta de Spotify:

1. Selecciona "Conectar Spotify" en el dashboard
2. Se abrirá tu navegador con la página de autorización de Spotify
3. Autoriza la aplicación GymBeat
4. Vuelve a la terminal y presiona Enter
5. La conexión se verificará automáticamente

**Nota:** Necesitas una cuenta de Spotify Premium para controlar la reproducción.

#### 4. Sesión de entrenamiento

Una vez conectado con Spotify:

1. Selecciona "Comenzar entrenamiento"
2. Elige el tipo de entrenamiento:
   - 🏃 **Running**: Cardio en carrera
   - 🏋️ **Lifting**: Entrenamiento de fuerza
   - 🥾 **Hiking**: Caminata en montaña
   - 💪 **Crossfit**: Entrenamiento funcional
   - ⚡ **HIIT**: Intervalos de alta intensidad
   - 🚴 **Cycling**: Entrenamiento en bicicleta
   - 🧘 **Mindfulness**: Meditación

3. La aplicación:
   - Carga tus preferencias musicales
   - Obtiene tu token de Spotify
   - Crea una sesión en el motor de música
   - Conecta al reproductor vía WebSocket
   - Encola canciones apropiadas en Spotify

#### 5. Controles de reproducción

Durante la sesión de entrenamiento, tendrás acceso a:

- **▶ Reproducir / ⏸ Pausar**: Controla la reproducción
- **⏭ Siguiente**: Avanza a la siguiente canción
- **⏮ Anterior**: Vuelve a la canción anterior
- **🔄 Actualizar estado**: Refresca la información de la canción actual
- **🛑 Finalizar sesión**: Termina el entrenamiento y vuelve al dashboard

La pantalla muestra:
- Canción actual y artista
- Duración de la sesión
- ID de sesión del motor
- Estado de la conexión WebSocket
- Última acción ejecutada

## 🏗️ Arquitectura

### Estructura del proyecto

```
frontend/cli/
├── src/
│   ├── api/              # Clientes API
│   │   ├── authApi.js    # Autenticación y Spotify
│   │   ├── httpClient.js # Cliente HTTP base
│   │   ├── playerSocket.js # WebSocket para reproductor
│   │   ├── trainingApi.js # API del motor de música
│   │   └── userApi.js    # API de usuarios
│   ├── commands/         # Comandos principales
│   │   ├── auth.js       # Comando de autenticación
│   │   ├── dashboard.js  # Comando del dashboard
│   │   └── training.js   # Comando de entrenamiento
│   ├── config/
│   │   └── config.js     # Configuración de la app
│   ├── services/         # Lógica de negocio
│   │   ├── authService.js     # Servicio de autenticación
│   │   ├── playerService.js   # Controlador del reproductor
│   │   ├── spotifyService.js  # Servicio de Spotify
│   │   └── trainingService.js # Servicio de entrenamiento
│   ├── utils/            # Utilidades
│   │   ├── display.js    # Funciones de UI
│   │   ├── storage.js    # Gestión de sesión
│   │   └── validators.js # Validadores de entrada
│   └── index.js          # Punto de entrada
├── .env.example          # Ejemplo de variables de entorno
├── .gitignore
├── package.json
└── README.md
```

### Flujo de datos

1. **Autenticación**: `authCommand` → `authService` → `authApi` → Backend
2. **Spotify**: `spotifyService` → `authApi` → Backend → Spotify OAuth
3. **Entrenamiento**: `trainingCommand` → `trainingService` → `trainingApi` → Music Service
4. **Reproducción**: `PlayerController` → `playerSocket` → WebSocket → Music Service → Spotify API

### Tecnologías utilizadas

- **inquirer**: Menús interactivos y prompts
- **chalk**: Colores en terminal
- **ora**: Spinners de carga
- **boxen**: Cajas decorativas
- **gradient-string**: Texto con gradientes
- **figlet**: Arte ASCII para el banner
- **axios**: Cliente HTTP
- **ws**: Cliente WebSocket
- **open**: Abrir URLs en el navegador

## 🔧 Configuración avanzada

### Variables de entorno

```env
# URLs de los servicios backend
AUTH_API_URL=http://localhost:8000
MUSIC_API_URL=http://localhost:8081
WS_API_URL=ws://localhost:8081

# Modo debug (muestra logs adicionales)
CLI_DEBUG=false
```

### Archivo de sesión

La sesión se guarda en `.session.json` en el directorio del CLI. Este archivo contiene:
- Información del usuario
- Tokens de acceso y refresh
- Estado de nuevo usuario

**Nota:** Este archivo es ignorado por git y debe mantenerse privado.

## 🐛 Solución de problemas

### Error: "No se puede conectar al servidor"

- Verifica que los servicios backend estén ejecutándose
- Comprueba las URLs en el archivo `.env`
- Asegúrate de que no haya firewalls bloqueando las conexiones

### Error: "Token de Spotify expirado"

- La aplicación intentará refrescar el token automáticamente
- Si persiste, reconecta Spotify desde el dashboard

### Error: "No se encontraron preferencias musicales"

- Completa la encuesta de música en la aplicación web
- O usa la API directamente para configurar tus preferencias

### La música no se reproduce

- Asegúrate de tener Spotify Premium
- Abre Spotify en cualquier dispositivo (móvil, desktop, web)
- Verifica que haya un dispositivo activo en Spotify
- La CLI controla el dispositivo activo, no reproduce directamente

### WebSocket se desconecta constantemente

- Verifica la estabilidad de tu conexión a internet
- Comprueba que el Music Service esté ejecutándose correctamente
- Revisa los logs del Music Service para errores

## 📝 Notas importantes

1. **Spotify Premium requerido**: La API de Spotify solo permite control de reproducción con cuentas Premium.

2. **Dispositivo activo**: La CLI controla el dispositivo de Spotify que esté activo. Asegúrate de tener Spotify abierto en algún dispositivo.

3. **Sesión persistente**: Tu sesión se guarda localmente. Para cerrar sesión completamente, usa la opción "Cerrar sesión" en el dashboard.

4. **Preferencias musicales**: Deben configurarse antes de iniciar un entrenamiento. Si no tienes preferencias, la aplicación te lo indicará.

5. **Conexión WebSocket**: La conexión se mantiene abierta durante toda la sesión de entrenamiento para control en tiempo real.

## 🤝 Contribución

Para contribuir al desarrollo del CLI:

1. Mantén la consistencia con la aplicación web
2. Sigue las convenciones de código existentes
3. Documenta nuevas funcionalidades
4. Prueba exhaustivamente antes de hacer commit

## 📄 Licencia

Este proyecto es parte de GymBeat y sigue la misma licencia del proyecto principal.

## 🆘 Soporte

Si encuentras problemas o tienes preguntas:
- Revisa la sección de solución de problemas
- Verifica los logs de los servicios backend
- Consulta la documentación de la aplicación web

---

**GymBeat CLI** - Entrena con ritmo desde tu terminal 🎵🏃‍♂️