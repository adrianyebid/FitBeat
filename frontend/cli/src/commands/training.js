import { readSession } from '../utils/storage.js';
import { getSpotifyToken } from '../services/spotifyService.js';
import {
  selectTrainingType,
  buildMusicPayload,
  createTrainingSession,
  getTrainingInfo,
} from '../services/trainingService.js';
import { PlayerController } from '../services/playerService.js';
import { displayInfo, displaySuccess, displayError, clearScreen } from '../utils/display.js';

/**
 * Training command - handles training session flow
 */

export async function trainingCommand() {
  const session = await readSession();
  
  if (!session || !session.user) {
    displayInfo('Debes iniciar sesión primero');
    return 'auth';
  }

  try {
    // Step 1: Select training type
    const trainingType = await selectTrainingType();
    const trainingInfo = getTrainingInfo(trainingType);
    
    clearScreen();
    displayInfo(`Iniciando sesión de ${trainingInfo.name} ${trainingInfo.icon}`);
    
    // Step 2: Load music preferences
    const musicPayload = await buildMusicPayload(session.user.id);
    
    // Step 3: Get Spotify token
    displayInfo('Obteniendo token de Spotify...');
    const spotifyToken = await getSpotifyToken(session.user.id);
    
    if (!spotifyToken) {
      displayError('No se pudo obtener el token de Spotify');
      return 'dashboard';
    }
    
    // Step 4: Create training session
    const sessionId = await createTrainingSession(
      session.user.id,
      trainingType,
      spotifyToken,
      musicPayload
    );
    
    displaySuccess(`Sesión creada: ${sessionId}`);
    displayInfo('Conectando al reproductor...');
    
    // Step 5: Initialize player controller
    const player = new PlayerController(session.user.id, sessionId, spotifyToken);
    
    try {
      await player.connect();
      player.startTimers();
      
      // Step 6: Player control loop
      let running = true;
      while (running) {
        player.displayStatus();
        
        const action = await player.showControls();
        
        switch (action) {
          case 'toggle':
            player.togglePlay();
            break;
          
          case 'next':
            player.next();
            break;
          
          case 'previous':
            player.previous();
            break;
          
          case 'refresh':
            await player.updateCurrentTrack();
            break;
          
          case 'finish':
            running = false;
            break;
        }
        
        // Small delay to show action feedback
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Cleanup
      player.disconnect();
      displaySuccess('Sesión de entrenamiento finalizada');
      displayInfo(`Duración total: ${Math.floor(player.elapsedTime / 60)} minutos`);
      
    } catch (error) {
      player.disconnect();
      displayError('Error durante la sesión de entrenamiento');
      displayError(error.message);
    }
    
    return 'dashboard';
    
  } catch (error) {
    displayError('Error al iniciar entrenamiento');
    displayError(error.message || 'Error desconocido');
    
    if (error.details && error.details.length > 0) {
      error.details.forEach(detail => displayError(`  - ${detail}`));
    }
    
    return 'dashboard';
  }
}

// Made with Bob
