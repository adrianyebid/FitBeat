from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.users.domain.schemas import UserCreate, UserResponse
from src.users.application.services import create_user, get_user

user_router = APIRouter(prefix="/users", tags=["Users"])

@user_router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    return create_user(db=db, user_in=user_in)

@user_router.get("/{user_id}", response_model=UserResponse)
def read_user(user_id: str, db: Session = Depends(get_db)):
    db_user = get_user(db=db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_user