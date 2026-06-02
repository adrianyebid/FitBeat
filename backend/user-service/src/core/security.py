import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from cryptography.fernet import Fernet
from jwt import ExpiredSignatureError, InvalidTokenError

from src.core.cache import cache_token_validation, get_cached_token_validation
from src.core.config import settings

logger = logging.getLogger(__name__)


PASSWORD_ALGORITHM = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 200_000

# Inicializamos el motor criptografico solo si hay una llave configurada
_fernet = None
if settings.ENCRYPTION_KEY:
    _fernet = Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_data(data: str) -> str:
    """Recibe texto plano y devuelve un token cifrado."""
    if not data or not _fernet:
        return data
    return _fernet.encrypt(data.encode()).decode()


def decrypt_data(encrypted_data: str) -> str:
    """Recibe un token cifrado y devuelve el texto plano."""
    if not encrypted_data or not _fernet:
        return encrypted_data
    return _fernet.decrypt(encrypted_data.encode()).decode()


def hash_password(plain_password: str) -> str:
    """Aplica PBKDF2-HMAC-SHA256 con salt aleatorio."""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode(),
        salt.encode(),
        PASSWORD_ITERATIONS,
    ).hex()
    return f"{PASSWORD_ALGORITHM}${PASSWORD_ITERATIONS}${salt}${pwd_hash}"


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica password contra hash almacenado."""
    try:
        algorithm, iterations, salt, stored_hash = password_hash.split("$", 3)
        if algorithm != PASSWORD_ALGORITHM:
            return False
        calculated = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode(),
            salt.encode(),
            int(iterations),
        ).hex()
        return secrets.compare_digest(stored_hash, calculated)
    except Exception:
        return False


def _build_token_payload(
    user_id: str,
    email: str,
    token_type: str,
    expires_delta: timedelta,
    token_id: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if token_id:
        payload["jti"] = token_id
    return payload


def create_access_token(user_id: str, email: str) -> str:
    payload = _build_token_payload(
        user_id=user_id,
        email=email,
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str, email: str, token_id: str) -> str:
    payload = _build_token_payload(
        user_id=user_id,
        email=email,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_id=token_id,
    )
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError as exc:
        raise ValueError("token expired") from exc
    except InvalidTokenError as exc:
        raise ValueError("invalid token") from exc

    token_type = payload.get("type")
    user_id = payload.get("sub")
    if token_type != expected_type or not user_id:
        raise ValueError("invalid token payload")
    return payload


async def decode_token_async(token: str, expected_type: str) -> dict[str, Any]:
    """
    Async version of decode_token with Redis caching.
    
    First checks Redis cache for previously validated token.
    On cache miss, performs JWT decode and caches result with TTL.
    
    Args:
        token: JWT token string
        expected_type: Expected token type ("access" or "refresh")
    
    Returns:
        Decoded token payload dict
    
    Raises:
        ValueError: If token is invalid, expired, or type mismatch
    """
    # Check cache first (< 1ms if hit)
    cached_payload = await get_cached_token_validation(token)
    if cached_payload and cached_payload.get("type") == expected_type:
        logger.debug(f"Token cache hit for type={expected_type}")
        return cached_payload
    
    # Cache miss: decode JWT normally
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError as exc:
        raise ValueError("token expired") from exc
    except InvalidTokenError as exc:
        raise ValueError("invalid token") from exc

    # Validate token type and structure
    token_type = payload.get("type")
    user_id = payload.get("sub")
    if token_type != expected_type or not user_id:
        raise ValueError("invalid token payload")
    
    # Cache result for future requests (TTL = time until token expiration)
    try:
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            now_timestamp = datetime.now(timezone.utc).timestamp()
            ttl_seconds = max(int(exp_timestamp - now_timestamp), 1)
            await cache_token_validation(token, payload, ttl_seconds)
    except Exception as e:
        logger.warning(f"Failed to cache token: {e}")
    
    return payload
