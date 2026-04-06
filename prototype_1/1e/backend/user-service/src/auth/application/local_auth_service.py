from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.auth.infrastructure.models import LocalAuthCredential, RefreshTokenSession
from src.core.config import settings
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from src.users.infrastructure.models import User


@dataclass
class AuthServiceError(Exception):
    message: str
    status_code: int = 400


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or "." not in normalized:
        raise AuthServiceError("email invalido", 400)
    return normalized


def _build_user_payload(credential: LocalAuthCredential) -> dict:
    created_at = credential.created_at or datetime.now(timezone.utc)
    return {
        "id": credential.user_id,
        "email": credential.email,
        "first_name": credential.first_name,
        "last_name": credential.last_name,
        "created_at": created_at,
    }


def _issue_token_pair(
    db: Session,
    *,
    user_id: str,
    email: str,
    revoke_token_id: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    refresh_token_id = uuid4().hex

    if revoke_token_id:
        previous = (
            db.query(RefreshTokenSession)
            .filter(RefreshTokenSession.token_id == revoke_token_id)
            .first()
        )
        if previous and previous.revoked_at is None:
            previous.revoked_at = now
            previous.replaced_by_token_id = refresh_token_id

    refresh_session = RefreshTokenSession(
        user_id=user_id,
        token_id=refresh_token_id,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh_session)

    return {
        "access_token": create_access_token(user_id=user_id, email=email),
        "refresh_token": create_refresh_token(
            user_id=user_id,
            email=email,
            token_id=refresh_token_id,
        ),
        "token_type": "bearer",
    }


def register_local_user(
    db: Session,
    *,
    first_name: str,
    last_name: str,
    email: str,
    password: str,
) -> dict:
    normalized_email = _normalize_email(email)

    existing = (
        db.query(LocalAuthCredential)
        .filter(LocalAuthCredential.email == normalized_email)
        .first()
    )
    if existing:
        raise AuthServiceError("el email ya esta registrado", 409)

    full_name = f"{first_name.strip()} {last_name.strip()}".strip()
    if len(full_name) < 2:
        raise AuthServiceError("nombre invalido", 400)

    db_user = User(
        name=full_name,
        age=settings.LOCAL_AUTH_DEFAULT_AGE,
    )
    db.add(db_user)
    db.flush()

    credential = LocalAuthCredential(
        user_id=db_user.id,
        email=normalized_email,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        password_hash=hash_password(password),
    )
    db.add(credential)
    token_payload = _issue_token_pair(db, user_id=db_user.id, email=normalized_email)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AuthServiceError("no se pudo registrar el usuario", 400) from exc

    db.refresh(credential)
    return {
        "user": _build_user_payload(credential),
        **token_payload,
    }


def login_local_user(db: Session, *, email: str, password: str) -> dict:
    normalized_email = _normalize_email(email)

    credential = (
        db.query(LocalAuthCredential)
        .filter(LocalAuthCredential.email == normalized_email)
        .first()
    )
    if not credential or not verify_password(password, credential.password_hash):
        raise AuthServiceError("credenciales invalidas", 401)

    token_payload = _issue_token_pair(
        db,
        user_id=credential.user_id,
        email=credential.email,
    )
    db.commit()

    return {
        "user": _build_user_payload(credential),
        **token_payload,
    }


def refresh_tokens(db: Session, *, refresh_token: str) -> dict:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except ValueError as exc:
        raise AuthServiceError(str(exc), 401) from exc

    user_id = str(payload["sub"])
    token_id = str(payload.get("jti") or "").strip()
    if not token_id:
        raise AuthServiceError("refresh token invalido", 401)

    refresh_session = (
        db.query(RefreshTokenSession)
        .filter(
            RefreshTokenSession.user_id == user_id,
            RefreshTokenSession.token_id == token_id,
        )
        .first()
    )

    if not refresh_session:
        raise AuthServiceError("refresh token no reconocido", 401)
    if refresh_session.revoked_at is not None:
        raise AuthServiceError("refresh token revocado", 401)
    if refresh_session.expires_at <= datetime.now(timezone.utc):
        raise AuthServiceError("refresh token expirado", 401)

    credential = (
        db.query(LocalAuthCredential)
        .filter(LocalAuthCredential.user_id == user_id)
        .first()
    )
    if not credential:
        raise AuthServiceError("usuario no encontrado", 404)

    token_payload = _issue_token_pair(
        db,
        user_id=credential.user_id,
        email=credential.email,
        revoke_token_id=token_id,
    )
    db.commit()
    return token_payload


def get_current_user(db: Session, *, access_token: str) -> dict:
    try:
        payload = decode_token(access_token, expected_type="access")
    except ValueError as exc:
        raise AuthServiceError(str(exc), 401) from exc

    user_id = str(payload["sub"])
    credential = (
        db.query(LocalAuthCredential)
        .filter(LocalAuthCredential.user_id == user_id)
        .first()
    )
    if not credential:
        raise AuthServiceError("usuario no encontrado", 404)

    return _build_user_payload(credential)
