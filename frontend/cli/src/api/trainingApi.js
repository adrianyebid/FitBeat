import { requestMusicService } from './httpClient.js';

/**
 * Training/Music Service API methods
 */

export async function createEngineSession(payload) {
  return requestMusicService('/api/v1/sessions', {
    method: 'POST',
    data: payload,
  });
}

// Made with Bob
