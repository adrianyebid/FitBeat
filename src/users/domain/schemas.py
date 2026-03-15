from pydantic import BaseModel, Field
from typing import Optional, List
from src.preferences.domain.models import Genero, Mood, Sport


class UserCreate(BaseModel):
    """Esquema para crear un usuario con sus preferencias."""

    name: str = Field(
        ...,
        min_length=2,
        description="Nombre del usuario. Debe tener al menos 2 caracteres.",
    )
    age: int = Field(
        ...,
        gt=0,
        lt=120,
        description="Edad del usuario. Debe ser mayor a 0 y menor a 120.",
    )

    # Preferencias (opcionales al momento de registro)
    preferred_genres: Optional[List[Genero]] = Field(
        default=None,
        description="Lista de géneros musicales preferidos.",
    )
    preferred_mood: Optional[Mood] = Field(
        default=None,
        description="Mood motivacional para la sesión.",
    )
    favorite_sport: Optional[Sport] = Field(
        default=None,
        description="Actividad física del usuario.",
    )


class UserResponse(BaseModel):
    id: str
    name: str
    age: int
    spotify_user_id: Optional[str] = None
    preferred_genres: Optional[List[str]] = None
    preferred_mood: Optional[str] = None
    favorite_sport: Optional[str] = None

    class Config:
        from_attributes = True
