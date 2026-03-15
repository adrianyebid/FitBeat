const MUSIC_PREFERENCES_KEY = "musicPreferences";

const GENRE_ALIASES = {
  pop: "pop",
  reggaeton: "reggaeton",
  "hip-hop": "hip-hop",
  "hip hop": "hip-hop",
  rap: "rap",
  rock: "rock",
  electronica: "electronic",
  electrnica: "electronic",
  alternativo: "alternative",
  clasica: "classical",
  classica: "classical",
  reggae: "reggae",
  dancehall: "dancehall",
  "regional mexicana": "regional-mexicana",
  baladas: "baladas",
  "baladas romanticas": "baladas",
};

const CATEGORY_ALIASES = {
  chill: "chill",
  latina: "latina",
  tristeza: "tristeza",
  nostalgia: "nostalgia",
  serenidad: "serenidad",
  alegria: "alegria",
  amor: "amor",
  despecho: "despecho",
  romance: "romance",
  mariachi: "mariachi",
};

function normalizeString(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mapAndDedupe(values, aliases) {
  const normalized = values
    .map((value) => aliases[normalizeString(value)] || normalizeString(value))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

export function readMusicPreferences(userId) {
  try {
    const raw = localStorage.getItem(MUSIC_PREFERENCES_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (userId && parsed.user_id && parsed.user_id !== userId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function buildMusicPayloadFromSurvey(userId) {
  const preferences = readMusicPreferences(userId);
  if (!preferences) {
    return null;
  }

  const genres = mapAndDedupe(preferences.genres || [], GENRE_ALIASES);
  const categories = mapAndDedupe(preferences.moods || [], CATEGORY_ALIASES);

  return {
    genres,
    categories,
  };
}
