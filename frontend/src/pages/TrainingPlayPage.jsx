import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTraining } from "../context/TrainingContext";
import { createEngineSession } from "../api/trainingApi";
import { getSpotifyInternalToken, getSpotifyNowPlaying } from "../api/authApi";
import {
  connectPlayerSocket,
  disconnectPlayerSocket,
  sendPlayerAction,
  sendUpdatedToken
} from "../api/playerSocket";
import { buildMusicPayloadFromSurvey } from "../utils/musicPreferences";

const TRAINING_NAMES = {
  running: "Running",
  lifting: "Lifting",
  hiking: "Hiking",
  crossfit: "Crossfit",
  hiit: "HIIT",
  cycling: "Cycling",
  mindfulness: "Mindfulness"
};

const TRAINING_ICONS = {
  running: "\u{1F3C3}",
  lifting: "\u{1F3CB}\uFE0F",
  hiking: "\u{1F97E}",
  crossfit: "\u{1F4AA}",
  hiit: "\u26A1",
  cycling: "\u{1F6B4}",
  mindfulness: "\u{1F9D8}"
};

const SOCKET_STATUS_LABELS = {
  disconnected: "Desconectado",
  connecting: "Conectando",
  connected: "Conectado",
  error: "Error"
};

const ACTION_LABELS = {
  play: "play",
  pause: "pause",
  next: "next",
  previous: "previous"
};

const USER_SPOTIFY_TOKEN_KEYS = [
  "spotify_token",
  "spotifyToken",
  "spotify_access_token",
  "spotifyAccessToken",
  "access_token",
  "accessToken"
];

function normalizeMode(mode) {
  const value = String(mode || "").trim().toLowerCase();
  if (value === "smartwatch") {
    return "automatic";
  }
  if (value === "manual") {
    return "manual";
  }
  return "manual";
}

function normalizeActivityType(trainingType) {
  const value = String(trainingType || "").trim().toLowerCase();
  if (!value) {
    return "running";
  }
  if (value === "hitt") {
    return "hiit";
  }
  return value;
}

function parseErrorMessage(error, fallbackMessage) {
  if (!error || typeof error !== "object") {
    return fallbackMessage;
  }

  const details = Array.isArray(error.details) ? error.details : [];
  if (details.length > 0) {
    return `${error.message || fallbackMessage} (${details.join(", ")})`;
  }

  return error.message || fallbackMessage;
}

function extractSpotifyTokenFromUser(user) {
  if (!user || typeof user !== "object") {
    return "";
  }

  for (const key of USER_SPOTIFY_TOKEN_KEYS) {
    const candidate = String(user[key] || "").trim();
    if (candidate) {
      return candidate;
    }
  }

  return "";
}

async function resolveSpotifyToken(user) {
  const userToken = extractSpotifyTokenFromUser(user);
  if (userToken) {
    return userToken;
  }

  const refreshed = await getSpotifyInternalToken(user?.id);
  return refreshed.accessToken;
}

function TrainingPlayPage() {
  const { trainingType } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { trainingSession, startTrainingSession, setEngineSessionId, clearTrainingSession } =
    useTraining();

  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [spotifyToken, setSpotifyToken] = useState("");
  const [lastPlayerAction, setLastPlayerAction] = useState("sin acciones");

  const retryActionRef = useRef(null);
  const refreshInProgressRef = useRef(false);
  const spotifyTokenRef = useRef("");

  const normalizedTrainingType = normalizeActivityType(trainingType);
  const trainingName = TRAINING_NAMES[normalizedTrainingType] || "Entrenamiento";
  const trainingIcon = TRAINING_ICONS[normalizedTrainingType] || "\u{1F3CB}\uFE0F";

  const [currentTrack, setCurrentTrack] = useState({
    name: "Spotify queue",
    artist: "Controlado por WebSocket"
  });
  const nowPlayingInFlightRef = useRef(false);

  useEffect(() => {
    startTrainingSession(normalizedTrainingType);
  }, [normalizedTrainingType, startTrainingSession]);

  useEffect(() => {
    if (!user?.id || !normalizedTrainingType || trainingSession.engineSessionId) {
      return;
    }

    let active = true;

    async function bootstrapSession() {
      setIsCreatingSession(true);
      setSessionError("");

      try {
        const musicPayload = buildMusicPayloadFromSurvey(user.id);
        if (!musicPayload) {
          throw new Error(
            "No encontramos tus preferencias musicales. Completa la encuesta para continuar."
          );
        }

        if (musicPayload.genres.length === 0 || musicPayload.categories.length === 0) {
          throw new Error(
            "Tus preferencias musicales no son validas. Completa de nuevo la encuesta."
          );
        }

        const token = await resolveSpotifyToken(user);
        if (!token) {
          throw new Error("No se encontro un token de Spotify valido para iniciar la sesion.");
        }

        const response = await createEngineSession({
          user_id: user.id,
          activity_type: normalizedTrainingType,
          mode: normalizeMode(trainingSession.mode),
          genres: musicPayload.genres,
          categories: musicPayload.categories,
          spotify_token: token
        });

        const sessionId = response?.data?.session_id || response?.data?.id;
        if (!sessionId) {
          throw new Error("No se recibio session_id del motor.");
        }

        if (active) {
          spotifyTokenRef.current = token;
          setSpotifyToken(token);
          setEngineSessionId(sessionId);
        }
      } catch (error) {
        if (active) {
          setSessionError(
            parseErrorMessage(error, "No se pudo crear la sesion de entrenamiento.")
          );
        }
      } finally {
        if (active) {
          setIsCreatingSession(false);
        }
      }
    }

    bootstrapSession();

    return () => {
      active = false;
    };
  }, [
    normalizedTrainingType,
    trainingSession.engineSessionId,
    trainingSession.mode,
    setEngineSessionId,
    user
  ]);

  useEffect(() => {
    let timerId;

    if (isPlaying) {
      timerId = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => clearInterval(timerId);
  }, [isPlaying]);

  useEffect(() => {
    if (!trainingSession.engineSessionId || !spotifyToken) {
      return;
    }

    let active = true;

    async function refreshSpotifyTokenAndRetry(expiredAction) {
      if (refreshInProgressRef.current) {
        return;
      }

      if (!user?.id) {
        setSessionError("No se pudo refrescar token: usuario no disponible.");
        return;
      }

      refreshInProgressRef.current = true;
      retryActionRef.current = expiredAction || null;
      setSessionError("Token de Spotify expirado. Actualizando...");

      try {
        const refreshed = await getSpotifyInternalToken(user.id);
        const newToken = refreshed.accessToken;
        spotifyTokenRef.current = newToken;
        sendUpdatedToken(newToken);
      } catch (error) {
        retryActionRef.current = null;
        setSessionError(
          parseErrorMessage(error, "No se pudo actualizar el token de Spotify.")
        );
      } finally {
        refreshInProgressRef.current = false;
      }
    }

    setWsStatus("connecting");
    setSessionError("");

    try {
      connectPlayerSocket(spotifyTokenRef.current || spotifyToken, {
        onOpen: () => {
          if (!active) {
            return;
          }
          setWsStatus("connected");
        },
        onClose: () => {
          if (!active) {
            return;
          }
          setWsStatus("disconnected");
          setIsPlaying(false);
        },
        onError: (error) => {
          if (!active) {
            return;
          }
          setWsStatus("error");
          setSessionError(
            parseErrorMessage(error, "No se pudo conectar el control del reproductor.")
          );
        },
        onMessage: (message) => {
          if (!active || !message || typeof message !== "object") {
            return;
          }

          const action = message.action;
          const messageText = message.message || "";

          if (message.event === "ok") {
            if (action === "play") {
              setIsPlaying(true);
            }
            if (action === "pause") {
              setIsPlaying(false);
            }
            if (action) {
              setLastPlayerAction(ACTION_LABELS[action] || action);
            }
            setSessionError("");

            if (action === "update_token" && retryActionRef.current) {
              const retryAction = retryActionRef.current;
              retryActionRef.current = null;
              try {
                sendPlayerAction(retryAction);
              } catch (error) {
                setSessionError(
                  parseErrorMessage(
                    error,
                    `No se pudo reintentar la accion ${ACTION_LABELS[retryAction] || retryAction}.`
                  )
                );
              }
            }
            return;
          }

          if (message.event === "token_expired") {
            refreshSpotifyTokenAndRetry(action);
            return;
          }

          if (message.event === "error") {
            setSessionError(
              messageText ||
                `El motor reporto error al ejecutar ${ACTION_LABELS[action] || "la accion"}.`
            );
          }
        }
      });
    } catch (error) {
      setWsStatus("error");
      setSessionError(
        parseErrorMessage(error, "No se pudo inicializar la conexion del reproductor.")
      );
    }

    return () => {
      active = false;
      disconnectPlayerSocket();
    };
  }, [spotifyToken, trainingSession.engineSessionId, user?.id]);

  useEffect(() => {
    if (!user?.id || !trainingSession.engineSessionId) {
      return;
    }

    let active = true;
    let intervalId;

    async function fetchNowPlaying() {
      if (nowPlayingInFlightRef.current) {
        return;
      }
      nowPlayingInFlightRef.current = true;

      try {
        const payload = await getSpotifyNowPlaying(user.id);
        if (!active) {
          return;
        }

        if (!payload?.track) {
          setCurrentTrack({
            name: "Sin reproduccion",
            artist: "Inicia Spotify en tu dispositivo activo"
          });
          return;
        }

        const artists = Array.isArray(payload.track.artists)
          ? payload.track.artists.join(", ")
          : "Spotify";
        setCurrentTrack({
          name: payload.track.name || "Sin titulo",
          artist: artists || "Spotify"
        });
      } catch {
        if (active) {
          setCurrentTrack({
            name: "No se pudo leer la cancion",
            artist: "Reintenta en unos segundos"
          });
        }
      } finally {
        nowPlayingInFlightRef.current = false;
      }
    }

    fetchNowPlaying();
    intervalId = setInterval(fetchNowPlaying, 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [user?.id, trainingSession.engineSessionId]);

  const controlsDisabled =
    isCreatingSession || isFinishingSession || wsStatus !== "connected";

  const handlePlayerAction = (action) => {
    setSessionError("");

    try {
      sendPlayerAction(action);
    } catch (error) {
      setSessionError(
        parseErrorMessage(
          error,
          `No se pudo enviar accion ${ACTION_LABELS[action] || action}.`
        )
      );
    }
  };

  const handleTogglePlay = () => {
    handlePlayerAction(isPlaying ? "pause" : "play");
  };

  const handleFinishSession = () => {
    setIsFinishingSession(true);
    disconnectPlayerSocket();
    clearTrainingSession();
    navigate("/dashboard");
  };

  const handleBackToTraining = () => {
    disconnectPlayerSocket();
    clearTrainingSession();
    navigate("/training/select-type");
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <main className="training-play-layout">
      <header className="training-play-header">
        <button type="button" className="ghost-btn back-btn" onClick={handleBackToTraining}>
          Back
        </button>
        <button type="button" className="ghost-btn" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="training-play-content">
        <div className="training-type-display">
          <div className="training-type-icon">{trainingIcon}</div>
          <h1>{trainingName}</h1>
        </div>

        <div className="timer-container">
          <div className="timer-display">{formatTime(elapsedTime)}</div>
          <p className="timer-label">Duracion</p>
        </div>

        {isCreatingSession ? (
          <div className="api-error" style={{ maxWidth: "460px" }}>
            <p>Inicializando sesion y cola de Spotify...</p>
          </div>
        ) : null}

        <div className="music-player">
          <div className="player-info">
            <p className="now-playing">{currentTrack.name}</p>
            <p className="track-artist">{currentTrack.artist}</p>
          </div>

          <div className="player-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <div className="progress-time">
              <span>0:00</span>
              <span>0:00</span>
            </div>
          </div>

          <div className="player-controls">
            <button
              type="button"
              className="control-btn prev-btn"
              title="Anterior"
              disabled={controlsDisabled}
              onClick={() => handlePlayerAction("previous")}
            >
              {"\u23EE"}
            </button>
            <button
              type="button"
              className="player-btn play-pause-btn"
              onClick={handleTogglePlay}
              title={isPlaying ? "Pausar" : "Reproducir"}
              disabled={controlsDisabled}
            >
              {isPlaying ? "\u23F8" : "\u25B6"}
            </button>
            <button
              type="button"
              className="control-btn next-btn"
              title="Siguiente"
              disabled={controlsDisabled}
              onClick={() => handlePlayerAction("next")}
            >
              {"\u23ED"}
            </button>
          </div>

          <div className="player-playlist">
            <h3>Sesion del motor</h3>
            <p className="empty-playlist">
              Session ID: {trainingSession.engineSessionId || "pendiente"}
            </p>
            <p className="empty-playlist">
              WebSocket: {SOCKET_STATUS_LABELS[wsStatus] || wsStatus}
            </p>
            <p className="empty-playlist">Ultima accion: {lastPlayerAction}</p>
          </div>
        </div>

        {sessionError ? (
          <div className="api-error" style={{ maxWidth: "460px" }}>
            <p>{sessionError}</p>
          </div>
        ) : null}

        <button
          type="button"
          className="finish-btn"
          onClick={handleFinishSession}
          disabled={isFinishingSession}
        >
          {isFinishingSession ? "Guardando..." : "Finalizar sesion"}
        </button>
      </section>
    </main>
  );
}

export default TrainingPlayPage;
