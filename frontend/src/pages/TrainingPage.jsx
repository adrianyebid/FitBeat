import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTraining } from "../context/TrainingContext";

function TrainingPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { setTrainingMode } = useTraining();
  const [selectedMode, setSelectedMode] = useState(null);

  const handleSelectMode = (mode) => {
    setSelectedMode(mode);
    setTrainingMode(mode);
    navigate("/training/select-type");
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
          Atras
        </button>
        <button type="button" className="ghost-btn" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="training-content">
        <div className="training-intro">
          <h1>Comienza tu entrenamiento</h1>
          <p>Selecciona como deseas registrar tu actividad</p>
        </div>

        <div className="training-cards">
          <div
            className={`training-card ${selectedMode === "smartwatch" ? "selected" : ""}`}
            onClick={() => handleSelectMode("smartwatch")}
          >
            <div className="card-icon">SW</div>
            <h2>Smartwatch</h2>
            <p>Sincroniza con tu dispositivo inteligente para tracking automatico</p>
            <button type="button" className="card-btn">
              Usar Smartwatch
            </button>
          </div>

          <div
            className={`training-card ${selectedMode === "manual" ? "selected" : ""}`}
            onClick={() => handleSelectMode("manual")}
          >
            <div className="card-icon">M</div>
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
