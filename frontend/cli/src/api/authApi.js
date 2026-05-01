import { request } from './httpClient.js';
import { getRefreshToken, updateTokens } from '../utils/storage.js';

/**
 * Authentication API methods
 */

export async function login(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    auth: false,
    data: credentials,
  });
}

export async function register(userData) {
  return request('/api/auth/register', {
    method: 'POST',
    auth: false,
    data: userData,
  });
}

export async function refreshSession() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('No hay refresh token disponible.');
  }
  
  const response = await request('/api/auth/refresh', {
    method: 'POST',
    auth: false,
    data: { refreshToken },
  });
  
  const tokens = {
    accessToken: response?.accessToken || response?.access_token || '',
    refreshToken: response?.refreshToken || response?.refresh_token || '',
  };
  
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error('El refresh no devolvió tokens válidos.');
  }
  
  await updateTokens(tokens);
  return tokens;
}

export async function getSpotifyInternalToken(userId) {
  if (!userId) {
    throw new Error('No se pudo obtener token de Spotify: user_id no disponible.');
  }
  
  const endpoint = `/auth/internal/token/${encodeURIComponent(userId)}`;
  
  try {
    const response = await request(endpoint, { method: 'GET' });
    return {
      accessToken: response?.access_token || '',
      userPreferences: response?.user_preferences || null,
    };
  } catch (error) {
    if (error?.statusCode === 401) {
      await refreshSession();
      const retry = await request(endpoint, { method: 'GET' });
      return {
        accessToken: retry?.access_token || '',
        userPreferences: retry?.user_preferences || null,
      };
    }
    throw error;
  }
}

export async function getSpotifyLoginUrl(userId) {
  if (!userId) {
    throw new Error('No se puede abrir Spotify sin user_id.');
  }
  const { config } = await import('../config/config.js');
  return `${config.authApiUrl}/auth/login/${encodeURIComponent(userId)}`;
}

export async function verifySpotifyConnection(userId) {
  if (!userId) {
    throw new Error('No se puede verificar Spotify sin user_id.');
  }
  
  return request(`/auth/verify-connection/${encodeURIComponent(userId)}`, {
    method: 'GET',
  });
}

export async function getSpotifyNowPlaying(userId) {
  if (!userId) {
    throw new Error('No se puede consultar la canción actual sin user_id.');
  }
  
  return request(`/auth/now-playing/${encodeURIComponent(userId)}`, {
    method: 'GET',
  });
}

// Made with Bob
