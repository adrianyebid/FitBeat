import inquirer from 'inquirer';
import { playerSocket } from '../api/playerSocket.js';
import { getSpotifyInternalToken } from '../api/authApi.js';
import { fetchCurrentTrack } from './trainingService.js';
import {
  clearScreen,
  displayCurrentTrack,
  displayTimer,
  displaySessionInfo,
  displayError,
  displaySuccess,
  displayWarning,
  displayInfo,
} from '../utils/display.js';

/**
 * Music player service for CLI
 */

const ACTION_LABELS = {
  play: 'reproducir',
  pause: 'pausar',
  next: 'siguiente',
  previous: 'anterior',
};

export class PlayerController {
  constructor(userId, sessionId, spotifyToken) {
    this.userId = userId;
    this.sessionId = sessionId;
    this.spotifyToken = spotifyToken;
    this.isPlaying = false;
    this.wsStatus = 'disconnected';
    this.lastAction = 'sin acciones';
    this.currentTrack = { name: 'Cargando...', artist: '...' };
    this.elapsedTime = 0;
    this.startTime = Date.now();
    this.timerInterval = null;
    this.trackUpdateInterval = null;
    this.isRefreshingToken = false;
    this.retryAction = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      playerSocket.connect(this.spotifyToken, {
        onOpen: () => {
          this.wsStatus = 'connected';
          displaySuccess('Reproductor conectado');
          resolve();
        },
        onClose: () => {
          this.wsStatus = 'disconnected';
          this.isPlaying = false;
        },
        onError: (error) => {
          this.wsStatus = 'error';
          displayError(error.message || 'Error de conexión WebSocket');
          reject(error);
        },
        onMessage: (message) => this.handleMessage(message),
      });
    });
  }

  async handleMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    const { event, action, message: msg } = message;

    if (event === 'ok') {
      if (action === 'play') {
        this.isPlaying = true;
      }
      if (action === 'pause') {
        this.isPlaying = false;
      }
      if (action) {
        this.lastAction = ACTION_LABELS[action] || action;
        if (action === 'next' || action === 'previous') {
          await this.updateCurrentTrack();
        }
      }

      if (action === 'update_token' && this.retryAction) {
        const retryAction = this.retryAction;
        this.retryAction = null;
        try {
          playerSocket.sendPlayerAction(retryAction);
        } catch (error) {
          displayError(`No se pudo reintentar la acción ${ACTION_LABELS[retryAction] || retryAction}`);
        }
      }
      return;
    }

    if (event === 'token_expired') {
      await this.refreshSpotifyToken(action);
      return;
    }

    if (event === 'error') {
      displayError(msg || `Error al ejecutar ${ACTION_LABELS[action] || 'la acción'}`);
    }
  }

  async refreshSpotifyToken(expiredAction) {
    if (this.isRefreshingToken) {
      return;
    }

    this.isRefreshingToken = true;
    this.retryAction = expiredAction || null;
    displayWarning('Token de Spotify expirado. Actualizando...');

    try {
      const refreshed = await getSpotifyInternalToken(this.userId);
      const newToken = refreshed.accessToken;
      this.spotifyToken = newToken;
      playerSocket.sendUpdatedToken(newToken);
      displaySuccess('Token actualizado');
    } catch (error) {
      this.retryAction = null;
      displayError('No se pudo actualizar el token de Spotify');
    } finally {
      this.isRefreshingToken = false;
    }
  }

  async updateCurrentTrack() {
    try {
      this.currentTrack = await fetchCurrentTrack(this.userId);
    } catch (error) {
      // Silently fail, will retry on next interval
    }
  }

  startTimers() {
    // Update elapsed time every second
    this.timerInterval = setInterval(() => {
      const elapsedMs = Date.now() - this.startTime;
      this.elapsedTime = Math.floor(elapsedMs / 1000);
    }, 1000);

    // Update current track every 5 seconds
    this.trackUpdateInterval = setInterval(() => {
      this.updateCurrentTrack();
    }, 5000);

    // Initial track fetch
    this.updateCurrentTrack();
  }

  stopTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.trackUpdateInterval) {
      clearInterval(this.trackUpdateInterval);
      this.trackUpdateInterval = null;
    }
  }

  sendAction(action) {
    try {
      // Optimistic update
      if (action === 'play') {
        this.isPlaying = true;
      }
      if (action === 'pause') {
        this.isPlaying = false;
      }
      if (action) {
        this.lastAction = ACTION_LABELS[action] || action;
      }

      playerSocket.sendPlayerAction(action);
    } catch (error) {
      displayError(error.message || `No se pudo enviar acción ${ACTION_LABELS[action] || action}`);
    }
  }

  togglePlay() {
    this.sendAction(this.isPlaying ? 'pause' : 'play');
  }

  next() {
    this.sendAction('next');
  }

  previous() {
    this.sendAction('previous');
  }

  displayStatus() {
    clearScreen();
    console.log('\n');
    displayCurrentTrack(this.currentTrack.name, this.currentTrack.artist);
    console.log(`\n  Duración: ${displayTimer(this.elapsedTime)}`);
    displaySessionInfo(this.sessionId, this.wsStatus, this.lastAction);
  }

  async showControls() {
    const choices = [
      { name: this.isPlaying ? '⏸  Pausar' : '▶  Reproducir', value: 'toggle' },
      { name: '⏭  Siguiente', value: 'next' },
      { name: '⏮  Anterior', value: 'previous' },
      { name: '🔄 Actualizar estado', value: 'refresh' },
      { name: '🛑 Finalizar sesión', value: 'finish' },
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Controles:',
        choices,
      },
    ]);

    return action;
  }

  disconnect() {
    this.stopTimers();
    playerSocket.disconnect();
  }
}

// Made with Bob
