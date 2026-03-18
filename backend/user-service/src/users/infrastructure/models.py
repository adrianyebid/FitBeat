import uuid
from sqlalchemy import Column, String, Integer, JSON
from src.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    spotify_user_id = Column(String, unique=True, nullable=True)

    # Preferencias musicales y deportivas
    preferred_genres = Column(JSON, nullable=True)      # Lista de géneros, ej: ["Rock", "Pop"]
    preferred_mood = Column(String, nullable=True)       # Mood motivacional
    favorite_sport = Column(String, nullable=True)       # Actividad física

