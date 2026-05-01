import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';

/**
 * Display utilities for CLI UI
 */

export function displayBanner() {
  console.clear();
  const banner = figlet.textSync('GymBeat', {
    font: 'Standard',
    horizontalLayout: 'default',
  });
  console.log(gradient.pastel.multiline(banner));
  console.log(chalk.gray('  Entrena con ritmo. Supera tus límites.\n'));
}

export function displayWelcome(userName) {
  const message = `Bienvenido, ${chalk.cyan(userName)}!`;
  console.log(boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
  }));
}

export function displaySuccess(message) {
  console.log(chalk.green('✓'), message);
}

export function displayError(message) {
  console.log(chalk.red('✗'), message);
}

export function displayWarning(message) {
  console.log(chalk.yellow('⚠'), message);
}

export function displayInfo(message) {
  console.log(chalk.blue('ℹ'), message);
}

export function displaySection(title) {
  console.log('\n' + chalk.bold.underline(title) + '\n');
}

export function displayTrainingType(icon, name, description) {
  console.log(`${icon}  ${chalk.bold(name)}`);
  console.log(`   ${chalk.gray(description)}`);
}

export function displayCurrentTrack(trackName, artist) {
  console.log(boxen(
    `${chalk.bold('♪ Reproduciendo:')}\n${chalk.cyan(trackName)}\n${chalk.gray(artist)}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: 'round',
      borderColor: 'magenta',
    }
  ));
}

export function displayTimer(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const timeStr = hours > 0
    ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  return chalk.bold.yellow(timeStr);
}

export function displaySessionInfo(sessionId, wsStatus, lastAction) {
  console.log(chalk.gray('\n─────────────────────────────────'));
  console.log(chalk.gray('Session ID:'), chalk.white(sessionId || 'pendiente'));
  console.log(chalk.gray('WebSocket:'), getStatusColor(wsStatus)(wsStatus));
  console.log(chalk.gray('Última acción:'), chalk.white(lastAction));
  console.log(chalk.gray('─────────────────────────────────\n'));
}

function getStatusColor(status) {
  switch (status) {
    case 'connected':
      return chalk.green;
    case 'connecting':
      return chalk.yellow;
    case 'disconnected':
      return chalk.gray;
    case 'error':
      return chalk.red;
    default:
      return chalk.white;
  }
}

export function clearScreen() {
  console.clear();
}

// Made with Bob
