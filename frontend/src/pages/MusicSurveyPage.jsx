import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const genres = [
  { name: "Pop", icon: "P" },
  { name: "Reggaeton", icon: "R" },
  { name: "Hip-Hop", icon: "H" },
  { name: "Rap", icon: "RP" },
  { name: "Rock", icon: "RK" },
  { name: "Electronica", icon: "E" },
  { name: "Alternativo", icon: "A" },
  { name: "Clasica", icon: "C" },
  { name: "Reggae", icon: "RG" },
  { name: "Dancehall", icon: "D" },
  { name: "Regional Mexicana", icon: "M" },
  { name: "Baladas", icon: "B" }
];

const moods = [
  { name: "Chill", icon: "CH" },
  { name: "Latina", icon: "L" },
  { name: "Tristeza", icon: "T" },
  { name: "Nostalgia", icon: "N" },
  { name: "Serenidad", icon: "S" },
  { name: "Alegria", icon: "AL" },
  { name: "Amor", icon: "AM" },
  { name: "Despecho", icon: "DE" },
  { name: "Romance", icon: "RO" },
  { name: "Mariachi", icon: "MA" }
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
      setStepError("Selecciona al menos un genero para continuar.");
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
          <h1>Personaliza tu musica</h1>
          <p>Selecciona lo que mas te motiva para entrenar</p>
        </div>

        {step === 1 && (
          <>
            <h2 className="survey-question">Que generos te gustan?</h2>

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
                Atras
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
