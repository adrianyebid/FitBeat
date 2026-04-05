from sqlalchemy.orm import Session
from src.users.domain.schemas import UserCreate, UpdateMusicPreferencesSchema
from src.users.infrastructure.models import User

def create_user(db: Session, user_in: UserCreate) -> User:
    db_user = User(
        name=user_in.name,
        age=user_in.age,
        preferred_genres=(
            [g.value for g in user_in.preferred_genres]
            if user_in.preferred_genres else None
        ),
        preferred_mood=(
            user_in.preferred_mood.value if user_in.preferred_mood else None
        ),
        favorite_sport=(
            user_in.favorite_sport.value if user_in.favorite_sport else None
        ),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id).first()

def update_music_preferences(db: Session, user_id: str, preferences: UpdateMusicPreferencesSchema) -> User | None:
    """Actualiza las preferencias musicales de un usuario y marca la encuesta como completada."""
    db_user = get_user(db=db, user_id=user_id)
    if db_user is None:
        return None
    
    db_user.preferred_genres = preferences.genres
    db_user.preferred_mood = preferences.moods[0] if preferences.moods else None
    db_user.music_survey_completed = True
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
