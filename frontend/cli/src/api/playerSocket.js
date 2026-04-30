import WebSocket from 'ws';
import { config } from '../config/config.js';

/**
 * WebSocket client for music player control
 */

const PLAYER_ACTIONS = new Set(['play', 'pause', 'next', 'previous']);

class PlayerSocket {
  constructor() {
    this.socket = null;
    this.currentToken = '';
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.shouldReconnect = false;
    this.listeners = {
      onOpen: null,
      onClose: null,
      onError: null,
      onMessage: null,
    };
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  notify(name, payload) {
    const handler = this.listeners[name];
    if (typeof handler === 'function') {
      handler(payload);
    }
  }

  socketUrl(token) {
    return `${config.wsApiUrl}/api/v1/ws?token=${encodeURIComponent(token)}`;
  }

  openSocket() {
    this.socket = new WebSocket(this.socketUrl(this.currentToken));

    this.socket.on('open', () => {
      this.reconnectAttempts = 0;
      this.notify('onOpen');
    });

    this.socket.on('message', (data) => {
      try {
        const payload = JSON.parse(data.toString());
        this.notify('onMessage', payload);
      } catch {
        this.notify('onError', new Error('Mensaje inválido recibido por WebSocket.'));
      }
    });

    this.socket.on('error', (error) => {
      this.notify('onError', new Error('Error de conexión WebSocket.'));
    });

    this.socket.on('close', () => {
      this.socket = null;
      this.notify('onClose');

      if (!this.shouldReconnect || this.reconnectAttempts >= 2 || !this.currentToken) {
        return;
      }

      this.reconnectAttempts += 1;
      this.reconnectTimer = setTimeout(() => {
        this.openSocket();
      }, 1000 * this.reconnectAttempts);
    });
  }

  sendMessage(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('El reproductor no está conectado.');
    }

    this.socket.send(JSON.stringify(payload));
  }

  connect(token, nextListeners = {}) {
    const normalizedToken = String(token || '').trim();
    if (!normalizedToken) {
      throw new Error('No se puede abrir WebSocket sin spotify token.');
    }

    this.listeners = { ...this.listeners, ...nextListeners };
    const sameToken = this.currentToken === normalizedToken;
    const isOpen = this.socket && this.socket.readyState === WebSocket.OPEN;
    const isConnecting = this.socket && this.socket.readyState === WebSocket.CONNECTING;

    if (sameToken && (isOpen || isConnecting)) {
      return;
    }

    this.clearReconnectTimer();
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.currentToken = normalizedToken;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }

    this.openSocket();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.currentToken = '';
    this.reconnectAttempts = 0;

    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.close();
    this.socket = null;
  }

  sendPlayerAction(action) {
    if (!PLAYER_ACTIONS.has(action)) {
      throw new Error(`Acción de reproductor no soportada: ${action}`);
    }
    this.sendMessage({ action });
  }

  sendUpdatedToken(token) {
    const normalizedToken = String(token || '').trim();
    if (!normalizedToken) {
      throw new Error('No se puede actualizar con un token vacío.');
    }

    this.currentToken = normalizedToken;
    this.sendMessage({ action: 'update_token', token: normalizedToken });
  }

  getStatus() {
    if (!this.socket) {
      return 'disconnected';
    }

    if (this.socket.readyState === WebSocket.CONNECTING) {
      return 'connecting';
    }

    if (this.socket.readyState === WebSocket.OPEN) {
      return 'connected';
    }

    if (this.socket.readyState === WebSocket.CLOSING) {
      return 'closing';
    }

    return 'closed';
  }
}

// Export singleton instance
export const playerSocket = new PlayerSocket();

// Made with Bob
