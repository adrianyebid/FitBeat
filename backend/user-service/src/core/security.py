import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from cryptography.fernet import Fernet
from jwt import ExpiredSignatureError, InvalidTokenError

from src.core.config import settings
from src.core import cache

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
    """
    Decode and validate JWT token with caching.
    
    First checks Redis cache for valid tokens, then falls back to JWT decoding.
    Cache hit avoids cryptographic operations and database lookups.
    """
    # Try to get cached validation first (Performance Pattern)
    cached_payload = cache.get_cached_token_validation(token)
    if cached_payload:
        # Verify it matches expected type
        if cached_payload.get("type") == expected_type:
            logger.debug(f"✓ Cache hit: token validation for user {cached_payload.get('sub')}")
            return cached_payload

    # Cache miss or invalid: decode and validate token
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

    # Cache the validated token (TTL = time until expiration)
    try:
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            ttl_seconds = max(1, int(exp_timestamp - datetime.now(timezone.utc).timestamp()))
            cache.cache_token_validation(token, payload, ttl_seconds)
            logger.debug(f"✓ Cached token validation for user {user_id} (TTL: {ttl_seconds}s)")
    except Exception as e:
        logger.warning(f"Failed to cache token: {e}")

    return payload
