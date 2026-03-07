# FitBeat Frontend

Frontend en React + Vite para autenticacion contra backend Spring Boot.

## Lo implementado hasta ahora

- Pantalla de autenticacion con 2 modos: login y registro.
- Validaciones en frontend:
  - Registro: `firstName`, `lastName`, `email`, `password`.
  - Login: `email`, `password`.
  - Email valido y password de minimo 6 caracteres.
- Integracion con backend:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Manejo de errores del backend (`message` y `details`).
- Persistencia de sesion en `localStorage` (`fitbeat-user`).
- Ruta protegida `/dashboard` y redireccion si no hay sesion.
- Logout con limpieza de sesion local.

## Como probarlo

1. Instala dependencias:

```bash
npm install
```

2. Configura URL del backend (opcional):

```bash
# archivo .env
VITE_API_BASE_URL=http://localhost:8080
```

Si no configuras `.env`, usa `http://localhost:8080` por defecto.

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
