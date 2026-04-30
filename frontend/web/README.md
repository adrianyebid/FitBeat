# GymBeat Web

Interfaz web para **GymBeat** - Entrena con ritmo, supera tus límites.

## Descripción

GymBeat Web es una aplicación React moderna que proporciona una interfaz visual completa para gestionar entrenamientos y recibir recomendaciones de música personalizadas basadas en tu actividad física.

## Características

### 🔐 Autenticación
- Registro de nuevos usuarios
- Inicio de sesión seguro
- Gestión de sesiones con tokens JWT

### 🏋️ Gestión de Entrenamientos
- Crear entrenamientos manuales y automáticos
- Registrar tipo, duración, intensidad y calorías
- Visualizar historial de entrenamientos
- Seguimiento en tiempo real

### 🎵 Integración Spotify
- Conectar cuenta de Spotify
- Obtener recomendaciones musicales personalizadas
- Reproducción de música durante entrenamientos

### ⚙️ Preferencias Musicales
- Seleccionar géneros favoritos
- Configurar tempo preferido
- Ajustar nivel de energía
- Control de contenido explícito

## Cómo probarlo

1. Instala dependencias:

```bash
npm install
```

2. Configura URLs de los servicios (opcional):

```bash
# archivo .env
VITE_AUTH_API_URL=http://localhost:8000
VITE_MUSIC_API_URL=http://localhost:8081
VITE_WS_API_URL=ws://localhost:8081
```

Si no configuras `.env`, el frontend usa esos mismos valores por defecto.

3. Levanta el frontend:

```bash
npm run dev
```

4. Flujo de prueba manual:

- Abre la URL de Vite (normalmente `http://localhost:5173`).
- Prueba registro con datos validos.
- Verifica que redirige a `/dashboard`.
- Recarga la pagina y confirma que mantiene sesion.
- Cierra sesion y confirma que vuelve al login.
- Prueba datos invalidos para ver mensajes de validacion y errores de API.

## Scripts

- `npm run dev`: desarrollo.
- `npm run build`: build de produccion.
- `npm run preview`: previsualizar build.
