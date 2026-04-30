import fs from 'fs/promises';
import { config } from '../config/config.js';

/**
 * Session storage manager for CLI
 * Stores authentication data in a local JSON file
 */

export async function readSession() {
  try {
    const data = await fs.readFile(config.sessionFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

export async function saveSession(session) {
  try {
    const normalized = {
      user: session?.user || null,
      accessToken: session?.accessToken || '',
      refreshToken: session?.refreshToken || '',
      isNewUser: session?.isNewUser || false,
    };
    await fs.writeFile(config.sessionFile, JSON.stringify(normalized, null, 2));
  } catch (error) {
    throw new Error(`Failed to save session: ${error.message}`);
  }
}

export async function clearSession() {
  try {
    await fs.unlink(config.sessionFile);
  } catch (error) {
    // File doesn't exist, that's fine
  }
}

export async function getAccessToken() {
  const session = await readSession();
  return session?.accessToken || '';
}

export async function getRefreshToken() {
  const session = await readSession();
  return session?.refreshToken || '';
}

export async function updateTokens({ accessToken, refreshToken }) {
  const session = await readSession();
  if (!session) {
    return;
  }
  
  await saveSession({
    ...session,
    accessToken: accessToken || session.accessToken || '',
    refreshToken: refreshToken || session.refreshToken || '',
  });
}

// Made with Bob
