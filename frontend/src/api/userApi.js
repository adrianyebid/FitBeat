import { request } from "./httpClient";

export async function updateMusicPreferences(userId, preferences) {
  if (!userId) {
    throw new Error("No se puede actualizar preferencias sin user_id.");
  }

  const payload = {
    genres: preferences.genres || [],
    moods: preferences.moods || []
  };

  return request(`/users/${encodeURIComponent(userId)}/music-preferences`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function getUserInfo(userId) {
  if (!userId) {
    throw new Error("No se puede obtener info del usuario sin user_id.");
  }

  return request(`/users/${encodeURIComponent(userId)}`, {
    method: "GET"
  });
}
