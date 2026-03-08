import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTraining } from "../context/TrainingContext";

function TrainingTypeSelectionPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { startTrainingSession } = useTraining();

  const trainingTypes = [
    {
      id: "running",
      name: "Running",
      icon: "🏃",
      description: "Cardio en carrera a diferentes ritmos e intensidades"
    },
    {
      id: "lifting",
      name: "Lifting",
      icon: "🏋️",
      description: "Entrenamiento de fuerza e hipertrofia muscular"
    },
    {
      id: "hiking",
      name: "Hiking",
      icon: "🥾",
      description: "Caminata en montaña o terremos naturales"
    },
    {
      id: "crossfit",
      name: "Crossfit",
      icon: "💪",
      description: "Entrenamiento funcional intenso y variado"
    },
    {
      id: "hitt",
      name: "HIIT",
      icon: "⚡",
      description: "Entrenamiento por intervalos de alta intensidad"
    },
    {
      id: "cycling",
      name: "Cycling",
      icon: "🚴",
      description: "Entrenamiento en bicicleta estática o al aire libre"
    },
    {
      id: "mindfulness",
      name: "Mindfulness",
      icon: "🧘",
      description: "Meditación y práctica de atención plena"
    }
  ];

  const handleSelectTraining = (trainingId) => {
    // Guardar el tipo de entrenamiento en el contexto
    startTrainingSession(trainingId);
    // Navegar a la página de reproducción
    navigate(`/training/play/${trainingId}`);
  };

  const handleBackToTraining = () => {
    navigate("/training");
  };

  return (
    <main className="training-layout">
      <header className="training-header">
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

      <section className="training-content">
        <div className="training-intro">
          <h1>Selecciona tu tipo de entrenamiento</h1>
          <p>Elige el tipo de actividad que realizarás</p>
        </div>

        <div className="training-types-grid">
          {trainingTypes.map((training) => (
            <div
              key={training.id}
              className="training-type-card"
              onClick={() => handleSelectTraining(training.id)}
            >
              <div className="type-card-icon">{training.icon}</div>
              <h2>{training.name}</h2>
              <p>{training.description}</p>
              <button type="button" className="card-btn">
                Seleccionar
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default TrainingTypeSelectionPage;
