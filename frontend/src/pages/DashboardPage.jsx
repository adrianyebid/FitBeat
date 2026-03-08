import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  const handleStartTraining = () => {
    navigate("/training");
  };

  return (
    <main className="dashboard-layout">
      <header className="dashboard-header">
        <button type="button" className="ghost-btn close-btn" onClick={logout}>
          Cerrar sesión
        </button>
      </header>

      <section className="dashboard-content">
        <div className="welcome-section">
          <p className="brand-pill">FitBeat</p>
          <h1 className="welcome-title">Bienvenido</h1>
          <h2 className="welcome-user">{fullName || "Usuario"}</h2>
          <p>{user?.email ?? "Sin correo"}</p>
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
