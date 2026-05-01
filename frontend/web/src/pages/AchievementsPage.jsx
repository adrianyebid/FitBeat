import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  evaluateAchievements,
  getAchievementsCatalog,
  getUserAchievements
} from "../api/achievementsApi";
import { useAuth } from "../context/AuthContext";

function createSessionId() {
  return `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function AchievementsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userId = useMemo(() => String(user?.id || ""), [user?.id]);

  const [catalog, setCatalog] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [durationMinutes, setDurationMinutes] = useState(30);
  const [sessionId, setSessionId] = useState(createSessionId());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) {
      setError("No se encontró el user id en la sesión.");
      setLoading(false);
      return;
    }

    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [catalogResult, progressResult] = await Promise.all([
          getAchievementsCatalog(),
          getUserAchievements(userId)
        ]);

        if (!active) {
          return;
        }

        setCatalog(Array.isArray(catalogResult) ? catalogResult : []);
        setProgress(progressResult || null);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err?.message || "No se pudo cargar la información de logros.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [userId]);

  const handleEvaluate = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!userId) {
      setError("No se encontró el user id en la sesión.");
      return;
    }

    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      setError("durationMinutes debe estar entre 1 y 1440.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        userId,
        sessionId: sessionId.trim() || createSessionId(),
        durationMinutes: minutes,
        completedAtUtc: new Date().toISOString()
      };

      const result = await evaluateAchievements(payload);
      const refreshedProgress = await getUserAchievements(userId);

      setProgress(refreshedProgress || null);
      setSessionId(createSessionId());

      if (Array.isArray(result?.newlyUnlocked) && result.newlyUnlocked.length > 0) {
        setInfo(`Logros desbloqueados: ${result.newlyUnlocked.join(", ")}`);
      } else {
        setInfo(result?.message || "Sesión evaluada sin nuevos logros.");
      }
    } catch (err) {
      const details = Array.isArray(err?.details) && err.details.length > 0
        ? ` (${err.details.join(" | ")})`
        : "";
      setError(`${err?.message || "No se pudo evaluar la sesión."}${details}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const unlockedCodes = new Set(
    Array.isArray(progress?.unlockedAchievements)
      ? progress.unlockedAchievements.map((item) => item.achievementCode)
      : []
  );

  return (
    <main className="training-layout">
      <header className="training-header">
        <button type="button" className="ghost-btn back-btn" onClick={() => navigate("/dashboard")}>
          ← Atrás
        </button>
        <button type="button" className="ghost-btn" onClick={logout}>
          Cerrar sesión
        </button>
      </header>

      <section className="achievements-content">
        <div className="achievements-title-block">
          <h1>Logros</h1>
          <p>Evalúa sesiones y revisa badges desbloqueados del usuario actual.</p>
        </div>

        {loading ? <p>Cargando logros...</p> : null}
        {error ? <p className="achievements-error">{error}</p> : null}
        {info ? <p className="achievements-info">{info}</p> : null}

        <div className="achievements-panel">
          <h2>Evaluar sesión</h2>
          <form className="achievements-form" onSubmit={handleEvaluate}>
            <label>
              User ID
              <input type="text" value={userId} readOnly />
            </label>
            <label>
              Session ID
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                maxLength={128}
              />
            </label>
            <label>
              Duración (minutos)
              <input
                type="number"
                min="1"
                max="1440"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </label>

            <button type="submit" className="primary-btn primary-btn-small" disabled={isSubmitting}>
              {isSubmitting ? "Evaluando..." : "Evaluar sesión"}
            </button>
          </form>
        </div>

        <div className="achievements-grid">
          <article className="achievements-panel">
            <h2>Progreso</h2>
            <p>Total sesiones: {progress?.progress?.totalSessions ?? 0}</p>
            <p>Racha actual (días): {progress?.progress?.currentStreakDays ?? 0}</p>
            <p>Minutos semanales: {progress?.progress?.weeklyMinutes ?? 0}</p>
          </article>

          <article className="achievements-panel">
            <h2>Catálogo</h2>
            <ul className="achievements-list">
              {catalog.map((item) => (
                <li key={item.code} className={unlockedCodes.has(item.code) ? "unlocked" : ""}>
                  <strong>{item.name}</strong>
                  <span>{item.code}</span>
                  <small>{item.description}</small>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}

export default AchievementsPage;
