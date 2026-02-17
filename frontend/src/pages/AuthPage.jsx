import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validateAuthForm } from "../utils/validators";

const LOGIN_INITIAL = {
  email: "",
  password: ""
};

const REGISTER_INITIAL = {
  firstName: "",
  lastName: "",
  email: "",
  password: ""
};

function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(LOGIN_INITIAL);
  const [formErrors, setFormErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [apiDetails, setApiDetails] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  function switchMode(nextMode) {
    setMode(nextMode);
    setForm(nextMode === "login" ? LOGIN_INITIAL : REGISTER_INITIAL);
    setFormErrors({});
    setApiError("");
    setApiDetails([]);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setApiError("");
    setApiDetails([]);

    const errors = validateAuthForm(mode, form);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(form);
      } else {
        await register(form);
      }
      navigate("/dashboard");
    } catch (error) {
      setApiError(error.message || "No se pudo completar la solicitud");
      setApiDetails(error.details || []);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <p className="brand-pill">GymTrack</p>
        <h1>Entrena con datos, no con suposiciones.</h1>
        <p className="brand-copy">
          Registra tu progreso y mantente constante. Este frontend ya esta conectado con tu
          backend de autenticacion.
        </p>
      </section>

      <section className="form-panel">
        <div className="form-tabs">
          <button
            type="button"
            className={mode === "login" ? "tab active" : "tab"}
            onClick={() => switchMode("login")}
          >
            Iniciar sesion
          </button>
          <button
            type="button"
            className={mode === "register" ? "tab active" : "tab"}
            onClick={() => switchMode("register")}
          >
            Crear cuenta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === "register" && (
            <>
              <label>
                Nombre
                <input name="firstName" value={form.firstName} onChange={updateField} />
                {formErrors.firstName ? <small>{formErrors.firstName}</small> : null}
              </label>

              <label>
                Apellido
                <input name="lastName" value={form.lastName} onChange={updateField} />
                {formErrors.lastName ? <small>{formErrors.lastName}</small> : null}
              </label>
            </>
          )}

          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={updateField} />
            {formErrors.email ? <small>{formErrors.email}</small> : null}
          </label>

          <label>
            Contrasena
            <input name="password" type="password" value={form.password} onChange={updateField} />
            {formErrors.password ? <small>{formErrors.password}</small> : null}
          </label>

          {apiError ? (
            <div className="api-error" role="alert">
              <p>{apiError}</p>
              {apiDetails.length > 0 ? (
                <ul>
                  {apiDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <button type="submit" className="primary-btn" disabled={isSubmitting}>
            {isSubmitting
              ? "Procesando..."
              : mode === "login"
                ? "Entrar a mi cuenta"
                : "Crear cuenta"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default AuthPage;
