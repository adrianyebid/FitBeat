from fastapi import FastAPI
from src.core.database import engine, Base

# 1. Importamos los routers
from src.users.infrastructure.routers import user_router
from src.auth.infrastructure.routers import auth_router

# 2. Importamos los modelos de SQLAlchemy ANTES de crear las tablas.
from src.users.infrastructure import models as user_models
from src.auth.infrastructure import models as auth_models

# 3.va a PostgreSQL y crea todas las tablas
# que hereden de 'Base' (users, spotify_tokens, etc.) si aún no existen.
Base.metadata.create_all(bind=engine)

# 4. Inicializamos la aplicación FastAPI
app = FastAPI(
    title="API Prototipo 1",
    description="Backend para sincronización de ritmo cardíaco y Spotify",
    version="1.0.0"
)

# 5. Conectamos los routers 
app.include_router(user_router)
app.include_router(auth_router)

# Un endpoint de prueba para saber que la raíz funciona
@app.get("/")
def read_root():
    return {"status": "¡El Componente A está funcionando!"}