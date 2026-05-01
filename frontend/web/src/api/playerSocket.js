const DEFAULT_WS_API_URL = "ws://localhost:8081";
const WS_API_URL = (import.meta.env.VITE_WS_API_URL || DEFAULT_WS_API_URL).replace(/\/$/, "");

const PLAYER_ACTIONS = new Set(["play", "pause", "next", "previous"]);

let socket = null;
let currentToken = "";
let currentSessionId = "";
let reconnectTimer = null;
let reconnectAttempts = 0;
let shouldReconnect = false;

let listeners = {
  onOpen: null,
  onClose: null,
  onError: null,
  onMessage: null
};

function clearReconnectTimer() {
  if (!reconnectTimer) {
    return;
  }
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function notify(name, payload) {
  const handler = listeners[name];
  if (typeof handler === "function") {
    handler(payload);
  }
}

function socketUrl(token) {
  const baseUrl = `${WS_API_URL}/api/v1/ws?token=${encodeURIComponent(token)}`;
  return currentSessionId
    ? `${baseUrl}&session_id=${encodeURIComponent(currentSessionId)}`
    : baseUrl;
}

function openSocket() {
  socket = new WebSocket(socketUrl(currentToken));

  socket.onopen = () => {
    reconnectAttempts = 0;
    notify("onOpen");
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      notify("onMessage", payload);
    } catch {
      notify("onError", new Error("Mensaje invalido recibido por WebSocket."));
    }
  };

  socket.onerror = () => {
    notify("onError", new Error("Error de conexion WebSocket."));
  };

  socket.onclose = (event) => {
    socket = null;
    notify("onClose", event);

    if (!shouldReconnect || reconnectAttempts >= 2 || !currentToken) {
      return;
    }

    reconnectAttempts += 1;
    reconnectTimer = setTimeout(() => {
      openSocket();
    }, 1000 * reconnectAttempts);
  };
}

function sendMessage(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error("El reproductor no esta conectado.");
  }

  socket.send(JSON.stringify(payload));
}

export function connectPlayerSocket(token, sessionIdOrListeners = {}, nextListeners = {}) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    throw new Error("No se puede abrir WebSocket sin spotify token.");
  }

  let sessionId = "";
  let mergedListeners = nextListeners;

  if (typeof sessionIdOrListeners === "string") {
    sessionId = String(sessionIdOrListeners || "").trim();
  } else if (sessionIdOrListeners && typeof sessionIdOrListeners === "object") {
    mergedListeners = sessionIdOrListeners;
  }

  listeners = { ...listeners, ...mergedListeners };
  const sameToken = currentToken === normalizedToken;
  const isOpen = socket && socket.readyState === WebSocket.OPEN;
  const isConnecting = socket && socket.readyState === WebSocket.CONNECTING;

  if (sameToken && (isOpen || isConnecting)) {
    return;
  }

  clearReconnectTimer();
  shouldReconnect = true;
  reconnectAttempts = 0;
  currentToken = normalizedToken;
  currentSessionId = sessionId;

  if (socket) {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.close();
    socket = null;
  }

  openSocket();
}

export function disconnectPlayerSocket() {
  shouldReconnect = false;
  clearReconnectTimer();
  currentToken = "";
  currentSessionId = "";
  reconnectAttempts = 0;

  if (!socket) {
    return;
  }

  socket.onopen = null;
  socket.onclose = null;
  socket.onerror = null;
  socket.onmessage = null;
  socket.close();
  socket = null;
}

export function sendPlayerAction(action) {
  if (!PLAYER_ACTIONS.has(action)) {
    throw new Error(`Accion de reproductor no soportada: ${action}`);
  }
  sendMessage({ action });
}

export function sendUpdatedToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    throw new Error("No se puede actualizar con un token vacio.");
  }

  currentToken = normalizedToken;
  sendMessage({ action: "update_token", token: normalizedToken });
}

export function getPlayerSocketStatus() {
  if (!socket) {
    return "disconnected";
  }

  if (socket.readyState === WebSocket.CONNECTING) {
    return "connecting";
  }

  if (socket.readyState === WebSocket.OPEN) {
    return "connected";
  }

  if (socket.readyState === WebSocket.CLOSING) {
    return "closing";
  }

  return "closed";
}
