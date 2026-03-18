import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
  const navigate = useNavigate();
  const { user } = useAuth();

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

  function finishSurvey() {
    if (selectedMoods.length === 0) {
      setStepError("Selecciona al menos un mood para continuar.");
      return;
    }

    const preferences = {
      user_id: user?.id || null,
      genres: selectedGenres,
      moods: selectedMoods,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem("musicPreferences", JSON.stringify(preferences));
    navigate("/dashboard");
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
              <button type="button" className="survey-continue-btn" onClick={nextStep}>
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
              <button type="button" className="survey-back-btn" onClick={prevStep}>
                ← Atrás
              </button>

              <button type="button" className="survey-continue-btn" onClick={finishSurvey}>
                Ir al dashboard
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default MusicSurveyPage;
