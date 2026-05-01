#!/usr/bin/env node

import { authCommand } from './commands/auth.js';
import { dashboardCommand } from './commands/dashboard.js';
import { trainingCommand } from './commands/training.js';
import { displayError, displayInfo } from './utils/display.js';

/**
 * GymBeat CLI - Main entry point
 * 
 * Flow:
 * 1. Authentication (login/register)
 * 2. Dashboard (main menu)
 * 3. Spotify connection verification
 * 4. Training session (select type, start session, control playback)
 */

async function main() {
  let currentCommand = 'auth';
  
  try {
    while (currentCommand !== 'exit') {
      switch (currentCommand) {
        case 'auth':
          currentCommand = await authCommand();
          break;
        
        case 'dashboard':
          currentCommand = await dashboardCommand();
          break;
        
        case 'training':
          currentCommand = await trainingCommand();
          break;
        
        default:
          displayError(`Comando desconocido: ${currentCommand}`);
          currentCommand = 'exit';
      }
    }
    
    displayInfo('\n¡Hasta pronto! 👋\n');
    process.exit(0);
    
  } catch (error) {
    displayError('\n❌ Error fatal en la aplicación');
    displayError(error.message || 'Error desconocido');
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  displayInfo('\n\n👋 Cerrando GymBeat CLI...\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  displayInfo('\n\n👋 Cerrando GymBeat CLI...\n');
  process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  displayError('Error no manejado en la aplicación');
  process.exit(1);
});

// Start the application
main();

// Made with Bob
