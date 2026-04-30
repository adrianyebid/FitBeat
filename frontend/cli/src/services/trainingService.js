import inquirer from 'inquirer';
import ora from 'ora';
import { getUserInfo } from '../api/userApi.js';
import { createEngineSession } from '../api/trainingApi.js';
import { getSpotifyNowPlaying } from '../api/authApi.js';
import { displayError, displayTrainingType, displaySection } from '../utils/display.js';

/**
 * Training service for CLI
 */

const TRAINING_TYPES = [
  {
    id: 'running',
    name: 'Running',
    icon: '🏃',
    description: 'Cardio en carrera a diferentes ritmos e intensidades',
  },
  {
    id: 'lifting',
    name: 'Lifting',
    icon: '🏋️',
    description: 'Entrenamiento de fuerza e hipertrofia muscular',
  },
  {
    id: 'hiking',
    name: 'Hiking',
    icon: '🥾',
    description: 'Caminata en montaña o terrenos naturales',
  },
  {
    id: 'crossfit',
    name: 'Crossfit',
    icon: '💪',
    description: 'Entrenamiento funcional intenso y variado',
  },
  {
    id: 'hiit',
    name: 'HIIT',
    icon: '⚡',
    description: 'Entrenamiento por intervalos de alta intensidad',
  },
  {
    id: 'cycling',
    name: 'Cycling',
    icon: '🚴',
    description: 'Entrenamiento en bicicleta estática o al aire libre',
  },
  {
    id: 'mindfulness',
    name: 'Mindfulness',
    icon: '🧘',
    description: 'Meditación y práctica de atención plena',
  },
];

const GENRE_ALIASES = {
  pop: 'pop',
  reggaeton: 'reggaeton',
  'hip-hop': 'hip-hop',
  'hip hop': 'hip-hop',
  rap: 'rap',
  rock: 'rock',
  electronica: 'electronic',
  electrnica: 'electronic',
  alternativo: 'alternative',
  clasica: 'classical',
  classica: 'classical',
  reggae: 'reggae',
  dancehall: 'dancehall',
  'regional mexicana': 'regional-mexicana',
  baladas: 'baladas',
  'baladas romanticas': 'baladas',
};

const CATEGORY_ALIASES = {
  chill: 'chill',
  latina: 'latina',
  tristeza: 'tristeza',
  nostalgia: 'nostalgia',
  serenidad: 'serenidad',
  alegria: 'alegria',
  amor: 'amor',
  despecho: 'despecho',
  romance: 'romance',
  mariachi: 'mariachi',
};

function normalizeString(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mapAndDedupe(values, aliases) {
  const normalized = values
    .map((value) => aliases[normalizeString(value)] || normalizeString(value))
    .filter(Boolean);
  
  return Array.from(new Set(normalized));
}

export async function selectTrainingType() {
  displaySection('Selecciona tu tipo de entrenamiento');
  
  // Display all training types
  TRAINING_TYPES.forEach(training => {
    displayTrainingType(training.icon, training.name, training.description);
  });
  
  console.log('');
  
  const { trainingType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'trainingType',
      message: 'Elige el tipo de actividad:',
      choices: TRAINING_TYPES.map(t => ({
        name: `${t.icon}  ${t.name}`,
        value: t.id,
      })),
    },
  ]);
  
  return trainingType;
}

export async function buildMusicPayload(userId) {
  const spinner = ora('Cargando preferencias musicales...').start();
  
  try {
    const userInfo = await getUserInfo(userId);
    
    if (!userInfo || !userInfo.preferred_genres || userInfo.preferred_genres.length === 0) {
      spinner.fail('No se encontraron preferencias musicales');
      throw new Error('No encontramos tus preferencias musicales. Completa la encuesta para continuar.');
    }
    
    const genres = mapAndDedupe(userInfo.preferred_genres, GENRE_ALIASES);
    const categories = userInfo.preferred_mood
      ? mapAndDedupe([userInfo.preferred_mood], CATEGORY_ALIASES)
      : [];
    
    if (genres.length === 0 || categories.length === 0) {
      spinner.fail('Preferencias musicales inválidas');
      throw new Error('Tus preferencias musicales no son válidas. Completa de nuevo la encuesta.');
    }
    
    spinner.succeed('Preferencias musicales cargadas');
    
    return { genres, categories };
  } catch (error) {
    spinner.fail('Error al cargar preferencias');
    throw error;
  }
}

export async function createTrainingSession(userId, trainingType, spotifyToken, musicPayload) {
  const spinner = ora('Creando sesión de entrenamiento...').start();
  
  try {
    const response = await createEngineSession({
      user_id: userId,
      activity_type: trainingType,
      mode: 'manual',
      genres: musicPayload.genres,
      categories: musicPayload.categories,
      spotify_token: spotifyToken,
      device_id: '', // CLI doesn't use web player, Spotify will use active device
    });
    
    const sessionId = response?.data?.session_id || response?.data?.id;
    
    if (!sessionId) {
      throw new Error('No se recibió session_id del motor.');
    }
    
    spinner.succeed('Sesión de entrenamiento creada');
    
    return sessionId;
  } catch (error) {
    spinner.fail('Error al crear sesión');
    throw error;
  }
}

export async function fetchCurrentTrack(userId) {
  try {
    const payload = await getSpotifyNowPlaying(userId);
    
    if (!payload?.track) {
      return {
        name: 'Sin reproducción',
        artist: 'Inicia Spotify en tu dispositivo activo',
      };
    }
    
    const artists = Array.isArray(payload.track.artists)
      ? payload.track.artists.join(', ')
      : 'Spotify';
    
    return {
      name: payload.track.name || 'Sin título',
      artist: artists || 'Spotify',
    };
  } catch {
    return {
      name: 'No se pudo leer la canción',
      artist: 'Reintenta en unos segundos',
    };
  }
}

export function getTrainingInfo(trainingType) {
  const training = TRAINING_TYPES.find(t => t.id === trainingType);
  return training || TRAINING_TYPES[0];
}

// Made with Bob
