import { AUTH_API_URL, request } from "./httpClient";
import { getRefreshToken, updateStoredTokens } from "../utils/authStorage";

function normalizeTokenPair(payload) {
  return {
    accessToken: payload?.accessToken || payload?.access_token || "",
    refreshToken: payload?.refreshToken || payload?.refresh_token || ""
  };
}

export function register(payload) {
  return request("/api/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload)
  });
}

export function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload)
  });
}

export async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No hay refresh token disponible.");
  }

  const response = await request("/api/auth/refresh", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ refreshToken })
  });

  const tokens = normalizeTokenPair(response);
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error("El refresh no devolvio tokens validos.");
  }

  updateStoredTokens(tokens);
  return tokens;
}

export async function getSpotifyInternalToken(userId) {
  if (!userId) {
    throw new Error("No se pudo obtener token de Spotify: user_id no disponible.");
  }

  const endpoint = `/auth/internal/token/${encodeURIComponent(userId)}`;

  try {
    const response = await request(endpoint, { method: "GET" });
    return {
      accessToken: response?.access_token || "",
      userPreferences: response?.user_preferences || null
    };
  } catch (error) {
    if (error?.statusCode === 401) {
      await refreshSession();
      const retry = await request(endpoint, { method: "GET" });
      return {
        accessToken: retry?.access_token || "",
        userPreferences: retry?.user_preferences || null
      };
    }
    throw error;
  }
}

export function getSpotifyLoginUrl(userId) {
  if (!userId) {
    throw new Error("No se puede abrir Spotify sin user_id.");
  }
  return `${AUTH_API_URL}/auth/login/${encodeURIComponent(userId)}`;
}

export function redirectToSpotifyLogin(userId) {
  window.location.assign(getSpotifyLoginUrl(userId));
}

export function verifySpotifyConnection(userId) {
  if (!userId) {
    throw new Error("No se puede verificar Spotify sin user_id.");
  }

  return request(`/auth/verify-connection/${encodeURIComponent(userId)}`, {
    method: "GET"
  });
}

export function getSpotifyNowPlaying(userId) {
  if (!userId) {
    throw new Error("No se puede consultar la cancion actual sin user_id.");
  }

  return request(`/auth/now-playing/${encodeURIComponent(userId)}`, {
    method: "GET"
  });
}
