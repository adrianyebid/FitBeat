import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { redirectToSpotifyLogin, verifySpotifyConnection } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  const [spotifyStatus, setSpotifyStatus] = useState("idle");
  const [spotifyMessage, setSpotifyMessage] = useState("");
  const lastSpotifyCheckRef = useRef(0);
  const spotifyCheckInFlightRef = useRef(false);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let active = true;
    const now = Date.now();
    const COOLDOWN_MS = 30000;
    if (spotifyCheckInFlightRef.current) {
      return;
    }
    if (now - lastSpotifyCheckRef.current < COOLDOWN_MS) {
      return;
    }

    async function checkSpotifyStatus() {
      spotifyCheckInFlightRef.current = true;
      setSpotifyStatus("loading");
      try {
        await verifySpotifyConnection(user.id);
        if (active) {
          setSpotifyStatus("connected");
          setSpotifyMessage("Spotify conectado");
        }
      } catch (error) {
        if (!active) {
          return;
        }
        if (error?.statusCode === 404) {
          setSpotifyStatus("disconnected");
          setSpotifyMessage("Spotify no conectado");
        } else {
          setSpotifyStatus("error");
          setSpotifyMessage(error?.message || "No se pudo verificar Spotify");
        }
      } finally {
        spotifyCheckInFlightRef.current = false;
        lastSpotifyCheckRef.current = Date.now();
      }
    }

    checkSpotifyStatus();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    if (search.get("spotify") === "connected") {
      setSpotifyMessage("Spotify conectado correctamente.");
      setSpotifyStatus("connected");
      lastSpotifyCheckRef.current = Date.now();
      navigate("/dashboard", { replace: true });
    }
  }, [location.search, navigate]);

  const handleStartTraining = () => {
    if (spotifyStatus !== "connected") {
      setSpotifyMessage("Conecta Spotify antes de iniciar entrenamiento.");
      return;
    }
    navigate("/training");
  };

  const handleConnectSpotify = () => {
    if (!user?.id) {
      return;
    }
    redirectToSpotifyLogin(user.id);
  };

  return (
    <main className="dashboard-layout">
      <header className="dashboard-header">
        <button type="button" className="ghost-btn close-btn" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-content">
        <div className="welcome-section">
          <p className="brand-pill">FitBeat</p>
          <h1 className="welcome-title">Bienvenido</h1>
          <h2 className="welcome-user">{fullName || "Usuario"}</h2>
          <p>{user?.email ?? "Sin correo"}</p>

          <p>
            Spotify:{" "}
            {spotifyStatus === "loading"
              ? "verificando..."
              : spotifyStatus === "connected"
                ? "conectado"
                : spotifyStatus === "disconnected"
                  ? "no conectado"
                  : spotifyStatus === "error"
                    ? "error"
                    : "sin verificar"}
          </p>
          {spotifyMessage ? <p>{spotifyMessage}</p> : null}

          <button
            type="button"
            className="primary-btn primary-btn-small"
            onClick={handleConnectSpotify}
          >
            {spotifyStatus === "connected" ? "Reconectar Spotify" : "Conectar Spotify"}
          </button>

          <button
            type="button"
            className="primary-btn primary-btn-small"
            onClick={handleStartTraining}
          >
            Comenzar entrenamiento
          </button>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
