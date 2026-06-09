import hmac

from fastapi import APIRouter, Depends, Header, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from src.auth.application.local_auth_service import (
    AuthServiceError,
    get_current_user,
    get_current_user_async,
    get_user_contact_by_id,
    login_local_user,
    refresh_tokens,
    refresh_tokens_async,
    register_local_user,
)
from src.core.config import settings
from src.core.consul_client import get_instances
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
async def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        result = await refresh_tokens_async(db, refresh_token=payload.refresh_token)
        return result
    except AuthServiceError as exc:
        return _error_response(exc.message, exc.status_code)


@local_auth_router.get("/me", response_model=AuthUserResponse)
async def me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    try:
        access_token = _extract_bearer_token(authorization)
        result = await get_current_user_async(db, access_token=access_token)
        return result
    except AuthServiceError as exc:
        return _error_response(exc.message, exc.status_code)


@local_auth_router.get("/internal/contact/{user_id}")
def get_user_contact(
    user_id: str,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
    db: Session = Depends(get_db),
):
    expected = settings.effective_internal_secret
    if not expected or not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        return _error_response("internal token invalido", 401)

    try:
        return get_user_contact_by_id(db, user_id=user_id)
    except AuthServiceError as exc:
        return _error_response(exc.message, exc.status_code)


@local_auth_router.get("/instances", tags=["Service Discovery"])
def list_instances():
    """
    Service Discovery — returns the list of healthy user-service instances
    currently registered in Consul.

    Use this endpoint to verify the pattern:
      - All 3 instances running  → healthy_instances: 3
      - One instance stopped     → healthy_instances: 2  (after ~15s)
      - Instance restarted       → healthy_instances: 3  (after ~15s)
    """
    if not settings.CONSUL_ADDR:
        return JSONResponse(
            status_code=503,
            content={"error": "Service discovery not configured (CONSUL_ADDR is empty)"},
        )

    instances = get_instances(settings.CONSUL_ADDR)
    healthy = [i for i in instances if i["status"] == "passing"]
    return {
        "service": "user-service",
        "healthy_instances": len(healthy),
        "instances": instances,
    }
