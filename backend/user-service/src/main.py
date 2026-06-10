from fastapi import FastAPI

from src.auth.infrastructure.local_auth_router import local_auth_router
from src.auth.infrastructure.routers import auth_router
from src.core import cache
from src.core.config import settings
from src.core.consul_client import deregister, register
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

app.include_router(user_router)
app.include_router(auth_router)
app.include_router(local_auth_router)


@app.on_event("startup")
async def startup_event():
    """Initialize Redis cache and register in Consul on startup."""
    await cache.init_redis(settings.redis_url)
    if settings.CONSUL_ADDR and settings.INSTANCE_HOST:
        register(
            consul_addr=settings.CONSUL_ADDR,
            instance_id=settings.INSTANCE_ID,
            instance_host=settings.INSTANCE_HOST,
            port=settings.SERVICE_PORT,
        )


@app.on_event("shutdown")
async def shutdown_event():
    """Deregister from Consul and close Redis cache on shutdown."""
    if settings.CONSUL_ADDR and settings.INSTANCE_HOST:
        deregister(
            consul_addr=settings.CONSUL_ADDR,
            instance_id=settings.INSTANCE_ID,
        )
    await cache.close_redis()


@app.get("/")
async def root_health_check():
    return {"status": "ok", "message": "Health Check Root"}


@app.get("/health")
async def health_check():
    """Health check endpoint with cache statistics."""
    cache_stats = await cache.get_cache_stats()
    return {
        "status": "healthy",
        "component": "Componente A (User Service)",
        "cache": cache_stats,
    }
