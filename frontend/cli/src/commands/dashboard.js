import inquirer from 'inquirer';
import { readSession } from '../utils/storage.js';
import { checkSpotifyConnection, connectSpotify } from '../services/spotifyService.js';
import { logout } from '../services/authService.js';
import { displayWelcome, displayInfo, displaySection, clearScreen } from '../utils/display.js';

/**
 * Dashboard command - main menu after authentication
 */

export async function dashboardCommand() {
  const session = await readSession();
  
  if (!session || !session.user) {
    displayInfo('Debes iniciar sesión primero');
    return 'auth';
  }

  clearScreen();
  displayWelcome(`${session.user.firstName} ${session.user.lastName}`);
  
  // Check Spotify connection
  const isSpotifyConnected = await checkSpotifyConnection(session.user.id);
  
  displaySection('Menú Principal');
  
  const choices = [
    { name: '🏃 Comenzar entrenamiento', value: 'training', disabled: !isSpotifyConnected },
    { name: '🎵 Conectar Spotify', value: 'spotify' },
    { name: '🚪 Cerrar sesión', value: 'logout' },
    { name: '❌ Salir', value: 'exit' },
  ];
  
  if (!isSpotifyConnected) {
    displayInfo('⚠️  Conecta Spotify antes de iniciar entrenamiento');
  }
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '¿Qué deseas hacer?',
      choices,
    },
  ]);
  
  switch (action) {
    case 'training':
      return 'training';
    
    case 'spotify':
      const connected = await connectSpotify(session.user.id);
      if (connected) {
        displayInfo('Presiona Enter para continuar...');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: '' }]);
      }
      return 'dashboard';
    
    case 'logout':
      await logout();
      return 'auth';
    
    case 'exit':
      return 'exit';
    
    default:
      return 'dashboard';
  }
}

// Made with Bob
