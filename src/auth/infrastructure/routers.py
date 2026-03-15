from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.auth.application.services import (
    get_spotify_auth_url,
    process_spotify_callback,
    get_spotify_profile,
    get_internal_token,
)

auth_router = APIRouter(prefix="/auth", tags=["Auth — Spotify OAuth"])


@auth_router.get("/login/{user_id}")
def spotify_login(user_id: str):
    """
    Redirige al usuario hacia la página de autorización de Spotify.

    El `user_id` se pasa como `state` en la URL para poder
    asociar los tokens al usuario correcto en el callback.
    """
    auth_url = get_spotify_auth_url(user_id)
    return RedirectResponse(url=auth_url)


@auth_router.get("/callback")
def spotify_callback(code: str, state: str, db: Session = Depends(get_db)):
    """
    Callback de Spotify: recibe el `code` y el `state` (user_id),
    intercambia el código por tokens y los persiste en la BD.
    """
    try:
        process_spotify_callback(code=code, user_id=state, db=db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "message": "Autenticación con Spotify exitosa",
        "user_id": state,
    }


@auth_router.get("/verify-connection/{user_id}")
def verify_spotify_connection(user_id: str, db: Session = Depends(get_db)):
    """
    Verifica que la conexión con Spotify funciona para el usuario dado.

    Retorna el display_name y el tipo de producto (premium/free)
    del perfil de Spotify asociado.
    """
    try:
        profile = get_spotify_profile(db=db, user_id=user_id)
    except ValueError as e:
        error_msg = str(e)
        # Distinguir entre "no tiene tokens" (404) y "error de API" (502)
        if "No se encontraron tokens" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        raise HTTPException(status_code=502, detail=error_msg)

    return {
        "message": "Conexión con Spotify verificada exitosamente",
        "spotify_profile": profile,
    }


@auth_router.get(
    "/internal/token/{user_id}",
    summary="Token Provider — Uso exclusivo inter-componentes",
    description=(
        "Endpoint interno para la comunicación entre Componente A y "
        "Componente B (Go). Entrega un access_token de Spotify válido "
        "y fresco. Si el token almacenado ha expirado, se refresca "
        "automáticamente antes de retornarlo. "
        "**No debe exponerse a clientes externos.**"
    ),
)
def get_token_for_component_b(user_id: str, db: Session = Depends(get_db)):
    """
    Token Provider Endpoint — Comunicación Componente A → Componente B.

    Retorna un JSON con contrato estricto:
    {
        "access_token": "string",
        "user_preferences": {
            "genres": ["Rock", "Pop"],
            "mood": "Alegria",
            "sport": "Running"
        }
    }
    """
    try:
        return get_internal_token(db=db, user_id=user_id)
    except ValueError as e:
        error_msg = str(e)
        if "No se encontraron tokens" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        raise HTTPException(status_code=502, detail=error_msg)

