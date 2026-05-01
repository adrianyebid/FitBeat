import inquirer from 'inquirer';
import ora from 'ora';
import open from 'open';
import { getSpotifyLoginUrl, verifySpotifyConnection, getSpotifyInternalToken } from '../api/authApi.js';
import { displaySuccess, displayError, displayWarning, displayInfo } from '../utils/display.js';

/**
 * Spotify authentication service for CLI
 */

export async function checkSpotifyConnection(userId) {
  const spinner = ora('Verificando conexión con Spotify...').start();
  
  try {
    await verifySpotifyConnection(userId);
    spinner.succeed('Spotify conectado');
    return true;
  } catch (error) {
    if (error?.statusCode === 404) {
      spinner.warn('Spotify no conectado');
      return false;
    }
    spinner.fail('Error al verificar Spotify');
    displayError(error.message || 'No se pudo verificar la conexión');
    return false;
  }
}

export async function connectSpotify(userId) {
  displayInfo('Para usar GymBeat necesitas conectar tu cuenta de Spotify.');
  displayWarning('Se abrirá tu navegador para autorizar la aplicación.');
  
  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: '¿Deseas continuar?',
      default: true,
    },
  ]);
  
  if (!proceed) {
    return false;
  }
  
  try {
    const url = await getSpotifyLoginUrl(userId);
    displayInfo(`Abriendo: ${url}`);
    await open(url);
    
    displayInfo('\nDespués de autorizar en el navegador, presiona Enter para continuar...');
    
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Presiona Enter cuando hayas completado la autorización',
      },
    ]);
    
    // Verify connection
    const spinner = ora('Verificando conexión...').start();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait a bit for the callback
    
    try {
      await verifySpotifyConnection(userId);
      spinner.succeed('Spotify conectado correctamente');
      return true;
    } catch (error) {
      spinner.fail('No se pudo verificar la conexión');
      displayError('Asegúrate de haber completado la autorización en el navegador');
      return false;
    }
  } catch (error) {
    displayError(error.message || 'Error al conectar con Spotify');
    return false;
  }
}

export async function getSpotifyToken(userId) {
  try {
    const result = await getSpotifyInternalToken(userId);
    return result.accessToken;
  } catch (error) {
    throw new Error('No se pudo obtener el token de Spotify: ' + error.message);
  }
}

// Made with Bob
