from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from src.auth.application.services import (
    get_internal_token,
    get_spotify_auth_url,
    get_spotify_now_playing,
    get_spotify_profile,
    process_spotify_callback,
)
from src.core.config import settings
from src.core.database import get_db
from src.core.security import decode_token


auth_router = APIRouter(prefix="/auth", tags=["Auth - Spotify OAuth"])


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="authorization header requerido")

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="authorization bearer invalido")

    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="token vacio")
    return token


@auth_router.get("/login/{user_id}")
def spotify_login(user_id: str):
    auth_url = get_spotify_auth_url(user_id)
    return RedirectResponse(url=auth_url)


@auth_router.get("/callback")
def spotify_callback(code: str, state: str, db: Session = Depends(get_db)):
    try:
        process_spotify_callback(code=code, user_id=state, db=db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    query = urlencode({"spotify": "connected", "user_id": state})
    redirect_url = f"{settings.FRONTEND_APP_URL.rstrip('/')}/dashboard?{query}"
    return RedirectResponse(url=redirect_url)


@auth_router.get("/verify-connection/{user_id}")
def verify_spotify_connection(user_id: str, db: Session = Depends(get_db)):
    try:
        profile = get_spotify_profile(db=db, user_id=user_id)
    except ValueError as exc:
        error_msg = str(exc)
        if "429" in error_msg:
            raise HTTPException(status_code=429, detail=error_msg) from exc
        if "No se encontraron tokens" in error_msg or "Error de Spotify al refrescar el token: 400" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg) from exc
        raise HTTPException(status_code=502, detail=error_msg) from exc

    return {
        "message": "Conexion con Spotify verificada exitosamente",
        "spotify_profile": profile,
    }


@auth_router.get("/now-playing/{user_id}")
def spotify_now_playing(user_id: str, db: Session = Depends(get_db)):
    try:
        return get_spotify_now_playing(db=db, user_id=user_id)
    except ValueError as exc:
        error_msg = str(exc)
        if "429" in error_msg:
            raise HTTPException(status_code=429, detail=error_msg) from exc
        if "No se encontraron tokens" in error_msg or "Error de Spotify al refrescar el token: 400" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg) from exc
        raise HTTPException(status_code=502, detail=error_msg) from exc


@auth_router.get(
    "/internal/token/{user_id}",
    summary="Token Provider - Uso interno",
    description=(
        "Entrega un access_token de Spotify valido y fresco. "
        "Requiere autenticacion estricta: Bearer JWT del usuario o "
        "X-Internal-Token para trafico inter-servicios."
    ),
)
def get_token_for_component_b(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
):
    authorized = False

    # Ruta service-to-service opcional
    if settings.INTERNAL_SERVICE_TOKEN:
        if x_internal_token and x_internal_token == settings.INTERNAL_SERVICE_TOKEN:
            authorized = True

    # Ruta estricta por usuario autenticado
    if not authorized:
        access_token = _extract_bearer_token(authorization)
        try:
            payload = decode_token(access_token, expected_type="access")
        except ValueError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

        token_user_id = str(payload.get("sub"))
        if token_user_id != user_id:
            raise HTTPException(status_code=403, detail="forbidden for this user_id")

    try:
        return get_internal_token(db=db, user_id=user_id)
    except ValueError as exc:
        error_msg = str(exc)
        if "No se encontraron tokens" in error_msg or "Error de Spotify al refrescar el token: 400" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg) from exc
        raise HTTPException(status_code=502, detail=error_msg) from exc
