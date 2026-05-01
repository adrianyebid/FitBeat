import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateMusicPreferences, getUserInfo } from "../api/userApi";

const genres = [
  { name: "Pop", icon: "🎤" },
  { name: "Reggaetón", icon: "🔥" },
  { name: "Hip-Hop", icon: "🎧" },
  { name: "Rap", icon: "🎙️" },
  { name: "Rock", icon: "🎸" },
  { name: "Electrónica", icon: "🎛️" },
  { name: "Alternativo", icon: "🎶" },
  { name: "Clásica", icon: "🎻" },
  { name: "Reggae", icon: "🌴" },
  { name: "Dancehall", icon: "💃" },
  { name: "Regional Mexicana", icon: "🤠" },
  { name: "Baladas", icon: "❤️" }
];

const moods = [
  { name: "Chill", icon: "🌙" },
  { name: "Latina", icon: "💃" },
  { name: "Tristeza", icon: "🥀" },
  { name: "Nostalgia", icon: "🕰️" },
  { name: "Serenidad", icon: "🌊" },
  { name: "Alegría", icon: "😄" },
  { name: "Amor", icon: "💖" },
  { name: "Despecho", icon: "💔" },
  { name: "Romance", icon: "🌹" },
  { name: "Mariachi", icon: "🎺" }
];

function MusicSurveyPage() {
  const [step, setStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [stepError, setStepError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();
  const { user, clearNewUserFlag } = useAuth();

  useEffect(() => {
    // Verificar si el usuario ya completó la encuesta
    const checkSurveyStatus = async () => {
      if (!user?.id) {
        navigate("/dashboard");
        return;
      }

      try {
        const userInfo = await getUserInfo(user.id);
        // Si ya completó la encuesta, redirigir al dashboard
        if (userInfo?.music_survey_completed) {
          clearNewUserFlag();
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Error al verificar estado de encuesta:", error);
        // Si hay error, permitir completar la encuesta
      } finally {
        setIsChecking(false);
      }
    };

    checkSurveyStatus();
  }, [user?.id, navigate, clearNewUserFlag]);

  function toggle(item, list, setList) {
    setStepError("");
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
      return;
    }
    setList([...list, item]);
  }

  function nextStep() {
    if (selectedGenres.length === 0) {
      setStepError("Selecciona al menos un género para continuar.");
      return;
    }
    setStepError("");
    setStep(2);
  }

  function prevStep() {
    setStepError("");
    setStep(1);
  }

  async function finishSurvey() {
    if (selectedMoods.length === 0) {
      setStepError("Selecciona al menos un mood para continuar.");
      return;
    }

    setIsLoading(true);
    setStepError("");

    try {
      // Guardar en la base de datos (única fuente de verdad)
      await updateMusicPreferences(user.id, {
        genres: selectedGenres,
        moods: selectedMoods
      });

      clearNewUserFlag();
      navigate("/dashboard");
    } catch (error) {
      console.error("Error al guardar preferencias:", error);
      setStepError("Error al guardar tus preferencias. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isChecking) {
    return (
      <main className="survey-layout">
        <section className="survey-card">
          <div className="survey-header">
            <p>Cargando...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="survey-layout">
      <section className="survey-card">
        <div className="survey-header">
          <h1>🎵 Personaliza tu música</h1>
          <p>Selecciona lo que más te motiva para entrenar</p>
        </div>

        {step === 1 && (
          <>
            <h2 className="survey-question">¿Qué géneros te gustan?</h2>

            <div className="survey-options-grid">
              {genres.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  className={`survey-option-card ${selectedGenres.includes(g.name) ? "active" : ""}`}
                  onClick={() => toggle(g.name, selectedGenres, setSelectedGenres)}
                  disabled={isLoading}
                >
                  <span className="survey-option-icon">{g.icon}</span>
                  <span>{g.name}</span>
                </button>
              ))}
            </div>

            {stepError ? (
              <div className="survey-error" role="alert">
                {stepError}
              </div>
            ) : null}

            <div className="survey-buttons">
              <div></div>
              <button type="button" className="survey-continue-btn" onClick={nextStep} disabled={isLoading}>
                Siguiente
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="survey-question">Que mood te motiva?</h2>

            <div className="survey-options-grid">
              {moods.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  className={`survey-option-card ${selectedMoods.includes(m.name) ? "active" : ""}`}
                  onClick={() => toggle(m.name, selectedMoods, setSelectedMoods)}
                  disabled={isLoading}
                >
                  <span className="survey-option-icon">{m.icon}</span>
                  <span>{m.name}</span>
                </button>
              ))}
            </div>

            {stepError ? (
              <div className="survey-error" role="alert">
                {stepError}
              </div>
            ) : null}

            <div className="survey-buttons">
              <button type="button" className="survey-back-btn" onClick={prevStep} disabled={isLoading}>
                ← Atrás
              </button>

              <button type="button" className="survey-continue-btn" onClick={finishSurvey} disabled={isLoading}>
                {isLoading ? "Guardando..." : "Ir al dashboard"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default MusicSurveyPage;
