from fastapi import APIRouter, Depends, Header, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from src.auth.application.local_auth_service import (
    AuthServiceError,
    get_current_user,
    get_user_contact_by_id,
    login_local_user,
    refresh_tokens,
    register_local_user,
)
from src.core.config import settings
from src.auth.domain.schemas import (
    AuthResponse,
    AuthUserResponse,
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
)
from src.core.database import get_db


local_auth_router = APIRouter(prefix="/api/auth", tags=["Auth - Local"])


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise AuthServiceError("authorization header requerido", 401)

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthServiceError("authorization bearer invalido", 401)

    token = parts[1].strip()
    if not token:
        raise AuthServiceError("token vacio", 401)
    return token


def _error_response(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"message": message, "details": []},
    )


@local_auth_router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    try:
        result = register_local_user(
            db,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            password=payload.password,
        )
        return result
    except AuthServiceError as exc:
        return _error_response(exc.message, exc.status_code)


@local_auth_router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    try:
        result = login_local_user(
            db,
            email=payload.email,
            password=payload.password,
        )
        return result
    except AuthServiceError as exc:
        return _error_response(exc.message, exc.status_code)


@local_auth_router.post("/refresh", response_model=RefreshResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        result = refresh_tokens(db, refresh_token=payload.refresh_token)
        return result
    except AuthServiceError as exc:
        return _error_response(exc.message, exc.status_code)


@local_auth_router.get("/me", response_model=AuthUserResponse)
def me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    try:
        access_token = _extract_bearer_token(authorization)
        result = get_current_user(db, access_token=access_token)
        return result
    except AuthServiceError as exc:
        return _error_response(exc.message, exc.status_code)


@local_auth_router.get("/internal/contact/{user_id}")
def get_user_contact(
    user_id: str,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
    db: Session = Depends(get_db),
):
    if not settings.INTERNAL_SERVICE_TOKEN or x_internal_token != settings.INTERNAL_SERVICE_TOKEN:
        return _error_response("internal token invalido", 401)

    try:
        return get_user_contact_by_id(db, user_id=user_id)
    except AuthServiceError as exc:
        return _error_response(exc.message, exc.status_code)
