import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validateAuthForm } from "../utils/validators";
import logoImage from "../../assets/logo.png";

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
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  function switchMode(nextMode) {
    setMode(nextMode);
    setForm(nextMode === "login" ? LOGIN_INITIAL : REGISTER_INITIAL);
    setFormErrors({});
    setApiError("");
    setApiDetails([]);
    setShowPassword(false);
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
      <section className="brand-section">
        <div className="fitbeat-logo">
          <img src={logoImage} alt="FitBeat Logo" className="fitbeat-logo-img" />
        </div>
        
        <h1>FitBeat</h1>
        <p>Entrena con ritmo. Supera tus límites.</p>
      </section>

      <section className="form-panel">
        {mode === "login" ? (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="email-field">
              <div className="form-field-wrapper">
                <i className="form-icon fas fa-user"></i>
                <input
                  id="email-field"
                  name="email"
                  type="email"
                  placeholder="Correo electrónico"
                  value={form.email}
                  onChange={updateField}
                />
              </div>
              {formErrors.email ? <small>{formErrors.email}</small> : null}
            </label>

            <label htmlFor="password-field">
              <div className="form-field-wrapper">
                <i className="form-icon fas fa-lock"></i>
                <input
                  id="password-field"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={updateField}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  <i className={`fas fa-${showPassword ? "eye-slash" : "eye"}`}></i>
                </button>
              </div>
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

            <div className="form-helpers">
              <a href="#" className="forgot-password">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button type="submit" className="primary-btn" disabled={isSubmitting}>
              {isSubmitting ? "Procesando..." : "Iniciar Sesión"}
            </button>

            <div className="form-helpers">
              <div className="signup-prompt">
                No tienes una cuenta?{" "}
                <a href="#" className="signup-link" onClick={(e) => {
                  e.preventDefault();
                  switchMode("register");
                }}>
                  Regístrate
                </a>
              </div>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="firstname-field">
              <div className="form-field-wrapper">
                <i className="form-icon fas fa-user"></i>
                <input
                  id="firstname-field"
                  name="firstName"
                  type="text"
                  placeholder="Nombre"
                  value={form.firstName}
                  onChange={updateField}
                />
              </div>
              {formErrors.firstName ? <small>{formErrors.firstName}</small> : null}
            </label>

            <label htmlFor="lastname-field">
              <div className="form-field-wrapper">
                <i className="form-icon fas fa-user"></i>
                <input
                  id="lastname-field"
                  name="lastName"
                  type="text"
                  placeholder="Apellido"
                  value={form.lastName}
                  onChange={updateField}
                />
              </div>
              {formErrors.lastName ? <small>{formErrors.lastName}</small> : null}
            </label>

            <label htmlFor="reg-email-field">
              <div className="form-field-wrapper">
                <i className="form-icon fas fa-envelope"></i>
                <input
                  id="reg-email-field"
                  name="email"
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={updateField}
                />
              </div>
              {formErrors.email ? <small>{formErrors.email}</small> : null}
            </label>

            <label htmlFor="reg-password-field">
              <div className="form-field-wrapper">
                <i className="form-icon fas fa-lock"></i>
                <input
                  id="reg-password-field"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={updateField}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  <i className={`fas fa-${showPassword ? "eye-slash" : "eye"}`}></i>
                </button>
              </div>
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
              {isSubmitting ? "Procesando..." : "Crear Cuenta"}
            </button>

            <div className="signup-prompt">
              ¿Ya tienes una cuenta?{" "}
              <a href="#" className="signup-link" onClick={(e) => {
                e.preventDefault();
                switchMode("login");
              }}>
                Iniciar Sesión
              </a>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default AuthPage;
