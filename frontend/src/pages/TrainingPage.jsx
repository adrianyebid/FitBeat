import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function TrainingPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);

  const handleSelectMode = (mode) => {
    setSelectedMode(mode);
    // Navegar según el modo seleccionado
    if (mode === "manual") {
      navigate("/training/select-type");
    }
    console.log(`Modo de entrenamiento seleccionado: ${mode}`);
  };

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <main className="training-layout">
      <header className="training-header">
        <button
          type="button"
          className="ghost-btn back-btn"
          onClick={handleBackToDashboard}
        >
          ← Atrás
        </button>
        <button type="button" className="ghost-btn" onClick={logout}>
          Cerrar sesión
        </button>
      </header>

      <section className="training-content">
        <div className="training-intro">
          <h1>Comienza tu entrenamiento</h1>
          <p>Selecciona cómo deseas registrar tu actividad</p>
        </div>

        <div className="training-cards">
          <div
            className={`training-card ${selectedMode === "smartwatch" ? "selected" : ""}`}
            onClick={() => handleSelectMode("smartwatch")}
          >
            <div className="card-icon">⌚</div>
            <h2>Smartwatch</h2>
            <p>Sincroniza con tu dispositivo inteligente para tracking automático</p>
            <button type="button" className="card-btn">
              Usar Smartwatch
            </button>
          </div>

          <div
            className={`training-card ${selectedMode === "manual" ? "selected" : ""}`}
            onClick={() => handleSelectMode("manual")}
          >
            <div className="card-icon">✋</div>
            <h2>Manual</h2>
            <p>Registra manualmente tu entrenamiento ingresando los datos</p>
            <button type="button" className="card-btn">
              Entrada Manual
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default TrainingPage;
