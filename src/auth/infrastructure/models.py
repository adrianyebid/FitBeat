from sqlalchemy import Column, String, Integer, ForeignKey
from src.core.database import Base


class SpotifyToken(Base):
    """
    Tabla 'spotify_tokens': Almacena los tokens de OAuth de Spotify
    para cada usuario del sistema.

    - user_id es FK hacia users.id y tiene constraint UNIQUE
      para garantizar un solo registro de tokens por usuario.
    - access_token y refresh_token se guardan en texto plano
      durante esta fase de validación.
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