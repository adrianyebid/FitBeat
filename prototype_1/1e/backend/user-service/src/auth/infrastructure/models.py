from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from src.core.database import Base


class SpotifyToken(Base):
    """
    Tabla spotify_tokens:
    - Guarda tokens OAuth de Spotify por usuario.
    - user_id apunta a users.id y es unico.
    """

    __tablename__ = "spotify_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        String,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
        index=True,
    )
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)


class LocalAuthCredential(Base):
    """
    Credenciales de autenticacion local de la aplicacion.
    Se mantienen separadas del modelo de preferencias de usuario.
    """

    __tablename__ = "local_auth_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        String,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
        index=True,
    )
    email = Column(String, unique=True, nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class RefreshTokenSession(Base):
    """
    Registro de refresh tokens para soportar rotacion y revocacion.
    - token_id (jti) es unico por token emitido.
    - revoked_at marca token invalidado.
    - replaced_by_token_id apunta al siguiente token tras rotacion.
    """

    __tablename__ = "refresh_token_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    token_id = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    replaced_by_token_id = Column(String, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
