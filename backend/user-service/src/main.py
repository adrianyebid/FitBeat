from fastapi import FastAPI

from src.auth.infrastructure.local_auth_router import local_auth_router
from src.auth.infrastructure.routers import auth_router
from src.core.config import settings
from src.core.database import Base, engine
from src.core import cache
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

app.include_router(user_router)
app.include_router(auth_router)
app.include_router(local_auth_router)


@app.on_event("startup")
async def startup_event():
    """Initialize Redis cache on startup."""
    redis_url = settings.redis_url
    if redis_url:
        cache.init_redis(redis_url)


@app.on_event("shutdown")
async def shutdown_event():
    """Close Redis connection on shutdown."""
    await cache.close_redis()


@app.get("/")
def read_root():
    return {"status": "Componente A funcionando"}


@app.get("/health")
def health_check():
    """Health check endpoint with cache status."""
    cache_stats = cache.get_cache_stats()
    return {
        "status": "healthy",
        "service": "user-service",
        "cache": cache_stats,
    }
