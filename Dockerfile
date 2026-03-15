# 1. Imagen base ligera
FROM python:3.11-slim

# 2. Directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Instalación de dependencias del sistema (necesarias para psycopg2/Postgres)
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# 4. Copiar e instalar librerías de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copiar el código fuente
COPY . .

# 6. Variable de entorno para que Python resuelva imports desde /app
ENV PYTHONPATH=/app

# 7. Exponer el puerto de FastAPI
EXPOSE 8000

# 8. Comando para arrancar la aplicación
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
