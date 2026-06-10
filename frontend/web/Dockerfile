# ── Stage 1: build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 💡 TRUCO: Al usar "/api", el navegador usará la IP del Ingress automáticamente.
# Ya no necesitas pasarle IPs fijas ni preocuparte si la IP de Google cambia.
ARG VITE_AUTH_API_URL=/api
ENV VITE_AUTH_API_URL=${VITE_AUTH_API_URL}

COPY package*.json ./
RUN npm ci --silent

COPY . .
RUN npm run build

# ── Stage 2: serve con nginx (sin HMR, sin WebSockets de dev) ────────
FROM nginx:stable-alpine

# Copia el build estático
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de nginx para SPA (react-router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]