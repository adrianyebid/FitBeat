from typing import List
from pydantic import BaseModel, Field
from src.preferences.domain.models import Genero, Mood, Sport

class RegistroPreferencias(BaseModel):
    user_id: str = Field(..., description="ID del usuario al que pertenecen estas preferencias")
    generos: List[Genero] = Field(..., description="Lista de géneros preferidos", min_length=1)
    moods: List[Mood] = Field(..., description="Lista de moods preferidos", min_length=1)

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "uuid-v4-example",
                "generos": ["Pop", "Rock"],
                "moods": ["Chill", "Alegria"]
            }
        }
