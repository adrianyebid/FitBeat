import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTraining } from "../context/TrainingContext";
import { createEngineSession, sendBiometric } from "../api/trainingApi";

function randomHeartRate() {
  return Math.floor(85 + Math.random() * 75);
}

function TrainingPlayPage() {
  const { trainingType } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    trainingSession,
    startTrainingSession,
    setEngineSessionId,
    setLatestDecision,
    clearTrainingSession
  } = useTraining();

  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const trainingNames = useMemo(
    () => ({
      running: "Running",
      lifting: "Lifting",
      hiking: "Hiking",
      crossfit: "Crossfit",
      hitt: "HIIT",
      cycling: "Cycling",
      mindfulness: "Mindfulness"
    }),
    []
  );

  const trainingIcons = useMemo(
    () => ({
      running: "RUN",
      lifting: "LFT",
      hiking: "HKG",
      crossfit: "CFT",
      hitt: "HIIT",
      cycling: "CYC",
      mindfulness: "ZEN"
    }),
    []
  );

  const currentTrack = trainingSession.latestDecision?.track
    ? {
        name: trainingSession.latestDecision.track.title,
        artist: trainingSession.latestDecision.track.artist
      }
    : {
        name: "Esperando recomendacion",
        artist: "Motor de musica"
      };

  useEffect(() => {
    startTrainingSession(trainingType);
  }, [trainingType, startTrainingSession]);

  useEffect(() => {
    if (!user?.id || !trainingType || trainingSession.engineSessionId) {
      return;
    }

    let isMounted = true;

    async function bootstrapSession() {
      setError("");
      try {
        const response = await createEngineSession({
          user_id: user.id,
          activity_type: trainingType,
          mode: trainingSession.mode || "manual"
        });

        const createdId = response?.data?.id;
        if (!createdId) {
          throw new Error("No session id returned by engine");
        }

        if (isMounted) {
          setEngineSessionId(createdId);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || "No se pudo crear la sesion en el motor.");
        }
      }
    }

    bootstrapSession();
    return () => {
      isMounted = false;
    };
  }, [
    user?.id,
    trainingType,
    trainingSession.engineSessionId,
    trainingSession.mode,
    setEngineSessionId
  ]);

  useEffect(() => {
    let intervalId;
    if (isPlaying) {
      intervalId = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying || !trainingSession.engineSessionId) {
      return;
    }

    let active = true;

    async function pushBiometric() {
      try {
        const response = await sendBiometric({
          session_id: trainingSession.engineSessionId,
          heart_rate: randomHeartRate()
        });
        if (active && response?.data) {
          setLatestDecision(response.data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err?.message || "Error enviando BPM al motor.");
        }
      }
    }

    pushBiometric();
    const biometricInterval = setInterval(pushBiometric, 8000);

    return () => {
      active = false;
      clearInterval(biometricInterval);
    };
  }, [isPlaying, trainingSession.engineSessionId, setLatestDecision]);

  const handleTogglePlay = () => {
    if (!trainingSession.engineSessionId) {
      setError("Aun no existe sesion activa en el motor.");
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const handleFinishSession = async () => {
    setIsLoading(true);
    setError("");

    try {
      clearTrainingSession();
      navigate("/dashboard");
    } catch {
      setError("Error al finalizar sesion.");
      setIsLoading(false);
    }
  };

  const handleBackToTraining = () => {
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
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <main className="training-play-layout">
      <header className="training-play-header">
        <button
          type="button"
          className="ghost-btn back-btn"
          onClick={handleBackToTraining}
        >
          Atras
        </button>
        <button type="button" className="ghost-btn" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="training-play-content">
        <div className="training-type-display">
          <div className="training-type-icon">{trainingIcons[trainingType] || "TRN"}</div>
          <h1>{trainingNames[trainingType] || "Entrenamiento"}</h1>
        </div>

        <div className="timer-container">
          <div className="timer-display">{formatTime(elapsedTime)}</div>
          <p className="timer-label">Duracion</p>
        </div>

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
              disabled
            >
              Prev
            </button>
            <button
              type="button"
              className="player-btn play-pause-btn"
              onClick={handleTogglePlay}
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="control-btn next-btn"
              title="Siguiente"
              disabled
            >
              Next
            </button>
          </div>

          <div className="player-playlist">
            <h3>Sesion del motor</h3>
            <p className="empty-playlist">
              Session ID: {trainingSession.engineSessionId || "pendiente"}
            </p>
            <p className="empty-playlist">
              Intensidad: {trainingSession.latestDecision?.intensity_level || "sin datos"}
            </p>
          </div>
        </div>

        {error ? (
          <div className="api-error" style={{ maxWidth: "460px" }}>
            <p>{error}</p>
          </div>
        ) : null}

        <button
          type="button"
          className="finish-btn"
          onClick={handleFinishSession}
          disabled={isLoading}
        >
          {isLoading ? "Guardando..." : "Finalizar sesion"}
        </button>
      </section>
    </main>
  );
}

export default TrainingPlayPage;
