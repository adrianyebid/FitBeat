import inquirer from 'inquirer';
import ora from 'ora';
import { login, register } from '../api/authApi.js';
import { saveSession, clearSession } from '../utils/storage.js';
import { validateEmail, validatePassword, validateRequired } from '../utils/validators.js';
import { displaySuccess, displayError, displayBanner } from '../utils/display.js';

/**
 * Authentication service for CLI
 */

export async function promptAuthChoice() {
  displayBanner();
  
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: '¿Qué deseas hacer?',
      choices: [
        { name: 'Iniciar sesión', value: 'login' },
        { name: 'Registrarse', value: 'register' },
        { name: 'Salir', value: 'exit' },
      ],
    },
  ]);
  
  return choice;
}

export async function promptLogin() {
  console.log('\n');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Correo electrónico:',
      validate: validateEmail,
    },
    {
      type: 'password',
      name: 'password',
      message: 'Contraseña:',
      mask: '*',
      validate: validatePassword,
    },
  ]);
  
  const spinner = ora('Iniciando sesión...').start();
  
  try {
    const result = await login(answers);
    
    const session = {
      user: result.user,
      accessToken: result.accessToken || result.access_token,
      refreshToken: result.refreshToken || result.refresh_token,
      isNewUser: false,
    };
    
    await saveSession(session);
    
    spinner.succeed('Sesión iniciada correctamente');
    displaySuccess(`Bienvenido, ${result.user.firstName}!`);
    
    return session;
  } catch (error) {
    spinner.fail('Error al iniciar sesión');
    displayError(error.message || 'No se pudo completar la solicitud');
    
    if (error.details && error.details.length > 0) {
      error.details.forEach(detail => displayError(`  - ${detail}`));
    }
    
    throw error;
  }
}

export async function promptRegister() {
  console.log('\n');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'firstName',
      message: 'Nombre:',
      validate: validateRequired('un nombre'),
    },
    {
      type: 'input',
      name: 'lastName',
      message: 'Apellido:',
      validate: validateRequired('un apellido'),
    },
    {
      type: 'input',
      name: 'email',
      message: 'Correo electrónico:',
      validate: validateEmail,
    },
    {
      type: 'password',
      name: 'password',
      message: 'Contraseña (mínimo 6 caracteres):',
      mask: '*',
      validate: validatePassword,
    },
  ]);
  
  const spinner = ora('Creando cuenta...').start();
  
  try {
    const result = await register(answers);
    
    const session = {
      user: result.user,
      accessToken: result.accessToken || result.access_token,
      refreshToken: result.refreshToken || result.refresh_token,
      isNewUser: true,
    };
    
    await saveSession(session);
    
    spinner.succeed('Cuenta creada correctamente');
    displaySuccess(`Bienvenido, ${result.user.firstName}!`);
    
    return session;
  } catch (error) {
    spinner.fail('Error al crear cuenta');
    displayError(error.message || 'No se pudo completar la solicitud');
    
    if (error.details && error.details.length > 0) {
      error.details.forEach(detail => displayError(`  - ${detail}`));
    }
    
    throw error;
  }
}

export async function logout() {
  await clearSession();
  displaySuccess('Sesión cerrada correctamente');
}

// Made with Bob
