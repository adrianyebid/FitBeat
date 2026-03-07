import { useAuth } from "../context/AuthContext";

function DashboardPage() {
  const { user, logout } = useAuth();
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  return (
    <main className="dashboard-layout">
      <header className="dashboard-header">
        <div>
          <p className="brand-pill">FitBeat</p>
          <h2>Bienvenido</h2>
          <p>{fullName || "Usuario"}</p>
          <p>{user?.email ?? "Sin correo"}</p>
        </div>
        <button type="button" className="ghost-btn" onClick={logout}>
          Cerrar sesion
        </button>
      </header>
    </main>
  );
}

export default DashboardPage;
