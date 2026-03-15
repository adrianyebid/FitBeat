from sqlalchemy.orm import Session
from src.users.domain.schemas import UserCreate
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
