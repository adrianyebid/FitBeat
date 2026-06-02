"""
JWT Token Caching Module
Performance Pattern: Reduces database hits by caching validated JWT tokens in Redis.

This module provides token validation caching with TTL-based expiration.
Cached tokens are automatically invalidated when they expire.
"""

import json
import logging
from typing import Any, Optional

import redis
from redis.connection import ConnectionPool

logger = logging.getLogger(__name__)

# Global Redis connection pool (shared across requests for efficiency)
_redis_pool: Optional[ConnectionPool] = None
_redis_client: Optional[redis.Redis] = None


def init_redis(redis_url: str) -> None:
    """Initialize Redis connection pool on startup."""
    global _redis_pool, _redis_client
    try:
        _redis_pool = redis.ConnectionPool.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
        )
        _redis_client = redis.Redis(connection_pool=_redis_pool)
        # Test connection
        _redis_client.ping()
        logger.info("✓ Redis cache initialized successfully")
    except Exception as e:
        logger.warning(f"⚠ Redis connection failed: {e}. Token caching disabled.")
        _redis_client = None


async def close_redis() -> None:
    """Close Redis connection on shutdown."""
    global _redis_pool
    if _redis_pool:
        _redis_pool.disconnect()
        logger.info("✓ Redis cache connection closed")


def _get_cache_key(token: str) -> str:
    """Generate cache key for a JWT token."""
    return f"jwt_token:{token[:20]}:{hash(token) % 1000000}"


def cache_token_validation(token: str, payload: dict[str, Any], ttl_seconds: int) -> None:
    """
    Cache a validated JWT token payload.

    Args:
        token: The JWT token string
        payload: The decoded token payload
        ttl_seconds: Time to live in seconds (should match token expiration)
    """
    if not _redis_client:
        return

    try:
        key = _get_cache_key(token)
        # Store payload as JSON with TTL
        _redis_client.setex(
            key,
            ttl_seconds,
            json.dumps(payload),
        )
        logger.debug(f"Cached token validation for user {payload.get('sub')}")
    except Exception as e:
        logger.warning(f"Failed to cache token: {e}")


def get_cached_token_validation(token: str) -> Optional[dict[str, Any]]:
    """
    Retrieve cached JWT token validation.

    Args:
        token: The JWT token string

    Returns:
        The cached payload if valid and not expired, None otherwise
    """
    if not _redis_client:
        return None

    try:
        key = _get_cache_key(token)
        cached_value = _redis_client.get(key)

        if cached_value:
            payload = json.loads(cached_value)
            logger.debug(f"Cache hit for token validation (user: {payload.get('sub')})")
            return payload

        return None
    except Exception as e:
        logger.warning(f"Failed to retrieve cached token: {e}")
        return None


def invalidate_token_cache(token: str) -> None:
    """Invalidate a cached token (e.g., on logout)."""
    if not _redis_client:
        return

    try:
        key = _get_cache_key(token)
        _redis_client.delete(key)
        logger.debug("Invalidated cached token")
    except Exception as e:
        logger.warning(f"Failed to invalidate token cache: {e}")


def get_cache_stats() -> dict[str, Any]:
    """Get Redis cache statistics for monitoring."""
    if not _redis_client:
        return {"status": "disabled"}

    try:
        info = _redis_client.info("stats")
        return {
            "status": "active",
            "total_commands": info.get("total_commands_processed", 0),
            "total_connections": info.get("total_connections_received", 0),
            "evicted_keys": info.get("evicted_keys", 0),
        }
    except Exception as e:
        logger.warning(f"Failed to get cache stats: {e}")
        return {"status": "error", "error": str(e)}
