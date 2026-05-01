import { promptAuthChoice, promptLogin, promptRegister } from '../services/authService.js';
import { readSession } from '../utils/storage.js';

/**
 * Authentication command - handles login and registration
 */

export async function authCommand() {
  // Check if already authenticated
  const session = await readSession();
  if (session && session.user) {
    return 'dashboard';
  }

  const choice = await promptAuthChoice();
  
  switch (choice) {
    case 'login':
      try {
        await promptLogin();
        return 'dashboard';
      } catch (error) {
        // Error already displayed in promptLogin
        return 'auth';
      }
    
    case 'register':
      try {
        await promptRegister();
        return 'dashboard';
      } catch (error) {
        // Error already displayed in promptRegister
        return 'auth';
      }
    
    case 'exit':
      return 'exit';
    
    default:
      return 'auth';
  }
}

// Made with Bob
