from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.auth.infrastructure.local_auth_router import local_auth_router
from src.auth.infrastructure.routers import auth_router
from src.core.config import settings
from src.core.database import Base, engine
from src.users.infrastructure.routers import user_router

# Importar modelos antes de create_all para registrar todas las tablas.
from src.auth.infrastructure import models as auth_models  # noqa: F401
from src.users.infrastructure import models as user_models  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FitBeat Component A API",
    description="Usuarios, autenticacion local y OAuth Spotify",
    version="1.1.0",
)

allowed_origins = ["http://localhost:5173", settings.FRONTEND_APP_URL]
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(auth_router)
app.include_router(local_auth_router)


@app.get("/")
def read_root():
    return {"status": "Componente A funcionando"}
