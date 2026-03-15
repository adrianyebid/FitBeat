
from urllib.parse import urlencode

import requests
from sqlalchemy.orm import Session

from src.core.config import settings
from src.auth.infrastructure.models import SpotifyToken
from src.users.infrastructure.models import User

# ──────────────────────────────────────────────
# Constantes del flujo OAuth de Spotify
# ──────────────────────────────────────────────
SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_ME_URL = "https://api.spotify.com/v1/me"
SCOPES = "user-read-playback-state user-modify-playback-state"


def get_spotify_auth_url(user_id: str) -> str:
    """
    Construye la URL de autorización de Spotify.

    El parámetro `state` transporta el `user_id` para que,
    al regresar en el callback, podamos asociar los tokens
    al usuario correcto.
    """
    params = {
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.REDIRECT_URI,
        "scope": SCOPES,
        "state": user_id,
    }
    return f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"


def process_spotify_callback(code: str, user_id: str, db: Session) -> dict:
    """
    Intercambia el código de autorización por tokens de acceso
    y los persiste en la tabla `spotify_tokens` usando lógica de upsert.

    Retorna el JSON de respuesta de Spotify en caso de éxito.
    Lanza ValueError si Spotify responde con error.
    """
    # 1. POST a Spotify para intercambiar el code por tokens
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.REDIRECT_URI,
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "client_secret": settings.SPOTIFY_CLIENT_SECRET,
    }

    response = requests.post(SPOTIFY_TOKEN_URL, data=payload, timeout=10)

    if response.status_code != 200:
        raise ValueError(
            f"Error de Spotify al intercambiar el código: "
            f"{response.status_code} — {response.text}"
        )

    token_data = response.json()
    access_token = token_data["access_token"]
    refresh_token = token_data["refresh_token"]

    # 2. Upsert: actualizar si el usuario ya tiene tokens, crear si no
    existing = (
        db.query(SpotifyToken)
        .filter(SpotifyToken.user_id == user_id)
        .first()
    )

    if existing:
        existing.access_token = access_token
        existing.refresh_token = refresh_token
    else:
        new_token = SpotifyToken(
            user_id=user_id,
            access_token=access_token,
            refresh_token=refresh_token,
        )
        db.add(new_token)

    db.commit()

    return token_data


def get_spotify_profile(db: Session, user_id: str) -> dict:
    """
    Verifica la conexión con Spotify para un usuario dado.

    1. Recupera el access_token en texto plano de spotify_tokens.
    2. Llama a GET https://api.spotify.com/v1/me con ese token.
    3. Retorna display_name y product (premium/free) del perfil.

    Lanza:
        ValueError  – si el usuario no tiene tokens almacenados.
        ValueError  – si la API de Spotify responde con error.
    """
    token_record = (
        db.query(SpotifyToken)
        .filter(SpotifyToken.user_id == user_id)
        .first()
    )

    if not token_record:
        raise ValueError(f"No se encontraron tokens de Spotify para el usuario {user_id}")

    headers = {"Authorization": f"Bearer {token_record.access_token}"}
    response = requests.get(SPOTIFY_ME_URL, headers=headers, timeout=10)

    if response.status_code != 200:
        raise ValueError(
            f"Error al consultar el perfil de Spotify: "
            f"{response.status_code} — {response.text}"
        )

    profile = response.json()

    return {
        "display_name": profile.get("display_name"),
        "product": profile.get("product"),
    }


def refresh_spotify_token(db: Session, db_token: SpotifyToken) -> None:
    """
    Refresca el access_token de Spotify usando el refresh_token almacenado.

    POST a https://accounts.spotify.com/api/token con grant_type=refresh_token.
    Actualiza el access_token en la BD. Si Spotify envía un nuevo
    refresh_token, también lo actualiza.

    Lanza ValueError si Spotify responde con error.
    """
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": db_token.refresh_token,
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "client_secret": settings.SPOTIFY_CLIENT_SECRET,
    }

    response = requests.post(SPOTIFY_TOKEN_URL, data=payload, timeout=10)

    if response.status_code != 200:
        raise ValueError(
            f"Error de Spotify al refrescar el token: "
            f"{response.status_code} — {response.text}"
        )

    token_data = response.json()

    # Siempre viene un nuevo access_token
    db_token.access_token = token_data["access_token"]

    # Spotify a veces envía un nuevo refresh_token, a veces no
    if "refresh_token" in token_data:
        db_token.refresh_token = token_data["refresh_token"]

    db.commit()


def get_valid_token(db: Session, user_id: str) -> str:
    """
    Retorna un access_token válido para el usuario, listo para
    ser usado en headers por el Componente B.

    Estrategia (try‑then‑refresh):
      1. Busca el registro del usuario en spotify_tokens.
      2. Intenta una petición rápida a /v1/me con el token actual.
      3. Si Spotify responde 401, refresca el token y lo reintenta.
      4. Retorna el access_token actualizado.

    Lanza ValueError si el usuario no tiene tokens o si el
    refresco falla.
    """
    db_token = (
        db.query(SpotifyToken)
        .filter(SpotifyToken.user_id == user_id)
        .first()
    )

    if not db_token:
        raise ValueError(
            f"No se encontraron tokens de Spotify para el usuario {user_id}"
        )

    # Prueba rápida con el token actual
    headers = {"Authorization": f"Bearer {db_token.access_token}"}
    test_response = requests.get(SPOTIFY_ME_URL, headers=headers, timeout=10)

    if test_response.status_code == 401:
        # Token expirado → refrescar y actualizar en la BD
        refresh_spotify_token(db=db, db_token=db_token)

    return db_token.access_token


def get_internal_token(db: Session, user_id: str) -> dict:
    """
    Token Provider para comunicación inter-componentes (A → B).

    Garantiza la entrega de un access_token válido y fresco
    usando la lógica de try‑then‑refresh de get_valid_token,
    e incluye las preferencias del usuario para el Componente B.

    Retorna:
        {
            "access_token": str,
            "user_preferences": {
                "genres": [...],
                "mood": str | None,
                "sport": str | None
            }
        }
    """

    access_token = get_valid_token(db=db, user_id=user_id)

    # Obtener preferencias del usuario
    user = db.query(User).filter(User.id == user_id).first()

    user_preferences = {
        "genres": user.preferred_genres or [] if user else [],
        "mood": user.preferred_mood if user else None,
        "sport": user.favorite_sport if user else None,
    }

    return {
        "access_token": access_token,
        "user_preferences": user_preferences,
    }



