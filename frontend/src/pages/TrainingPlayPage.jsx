import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTraining } from "../context/TrainingContext";
import { saveTrainingSession } from "../api/trainingApi";

function TrainingPlayPage() {
  const { trainingType } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { trainingSession, startTrainingSession, clearTrainingSession } =
    useTraining();
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTrack, setCurrentTrack] = useState({
    name: "Conectando con Spotify",
    artist: "Web Playback SDK",
    albumArt: null,
  });

  const trainingNames = {
    running: "Running",
    lifting: "Lifting",
    hiking: "Hiking",
    crossfit: "Crossfit",
    hitt: "HIIT",
    cycling: "Cycling",
    mindfulness: "Mindfulness",
  };

  const trainingIcons = {
    running: "🏃",
    lifting: "🏋️",
    hiking: "🥾",
    crossfit: "💪",
    hitt: "⚡",
    cycling: "🚴",
    mindfulness: "🧘",
  };

  useEffect(() => {
    // Iniciar sesión de entrenamiento
    startTrainingSession(trainingType);
  }, [trainingType, startTrainingSession]);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNextTrack = () => {
    console.log("Siguiente canción");
    // Aquí irá la lógica para Spotify Web Playback SDK
  };

  const handlePreviousTrack = () => {
    console.log("Canción anterior");
    // Aquí irá la lógica para Spotify Web Playback SDK
  };

  const handleFinishSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Calcular duración
      const duration = Math.floor((new Date() - trainingSession.startTime) / 1000);

      // Preparar datos para enviar al backend
      const sessionData = {
        userId: user?.id,
        trainingType: trainingType,
        duration: duration,
        startTime: trainingSession.startTime,
        endTime: new Date(),
      };

      // Enviar datos al backend
      const response = await saveTrainingSession(sessionData);
      console.log("Sesión guardada:", response);

      // Limpiar sesión y navegar
      clearTrainingSession();
      navigate("/dashboard");
    } catch (err) {
      console.error("Error al guardar sesión:", err);
      setError("Error al guardar la sesión. Intenta de nuevo.");
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
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <main className="training-play-layout">
      <header className="training-play-header">
        <button
          type="button"
          className="ghost-btn back-btn"
          onClick={handleBackToTraining}
        >
          ← Atrás
        </button>
        <button type="button" className="ghost-btn" onClick={logout}>
          Cerrar sesión
        </button>
      </header>

      <section className="training-play-content">
        <div className="training-type-display">
          <div className="training-type-icon">
            {trainingIcons[trainingType] || "🏋️"}
          </div>
          <h1>{trainingNames[trainingType] || "Entrenamiento"}</h1>
        </div>

        {/* Timer */}
        <div className="timer-container">
          <div className="timer-display">{formatTime(elapsedTime)}</div>
          <p className="timer-label">Duración</p>
        </div>

        {/* Music Player */}
        <div className="music-player">
          {/* Album Art */}
          <div className="album-art-container">
            {currentTrack.albumArt ? (
              <img
                src={currentTrack.albumArt}
                alt="Portada del álbum"
                className="album-art"
              />
            ) : (
              <div className="album-art-placeholder">
                <span className="placeholder-icon">🎵</span>
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="player-info">
            <p className="now-playing">{currentTrack.name}</p>
            <p className="track-artist">{currentTrack.artist}</p>
          </div>

          {/* Progress Bar */}
          <div className="player-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <div className="progress-time">
              <span>0:00</span>
              <span>0:00</span>
            </div>
          </div>

          {/* Player Controls */}
          <div className="player-controls">
            <button
              type="button"
              className="control-btn prev-btn"
              onClick={handlePreviousTrack}
              title="Anterior"
            >
              ⏮
            </button>
            <button
              type="button"
              className="player-btn play-pause-btn"
              onClick={handleTogglePlay}
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              className="control-btn next-btn"
              onClick={handleNextTrack}
              title="Siguiente"
            >
              ⏭
            </button>
          </div>

          {/* Playlist */}
          <div className="player-playlist">
            <h3>Cola de reproducción</h3>
            <p className="empty-playlist">
              Se conectará a Spotify cuando esté integrado
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="api-error" style={{ maxWidth: "300px" }}>
            <p>{error}</p>
          </div>
        )}

        {/* Finish Session Button */}
        <button
          type="button"
          className="finish-btn"
          onClick={handleFinishSession}
          disabled={isLoading}
        >
          {isLoading ? "Guardando..." : "Finalizar Sesión"}
        </button>
      </section>
    </main>
  );
}

export default TrainingPlayPage;
