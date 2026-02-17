import { useAuth } from "../context/AuthContext";

function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main className="dashboard-layout">
      <header className="dashboard-header">
        <div>
          <p className="brand-pill">GymTrack</p>
          <h2>
            Bienvenido, {user.firstName} {user.lastName}
          </h2>
          <p>{user.email}</p>
        </div>
        <button type="button" className="ghost-btn" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="cards-grid">
        <article className="stat-card">
          <p>Estado</p>
          <h3>Login correcto</h3>
          <span>Tu flujo de autenticacion ya esta funcionando</span>
        </article>
        <article className="stat-card">
          <p>Siguiente paso</p>
          <h3>Rutinas y progreso</h3>
          <span>Conecta aqui los endpoints que sigan en tu backend</span>
        </article>
      </section>
    </main>
  );
}

export default DashboardPage;
