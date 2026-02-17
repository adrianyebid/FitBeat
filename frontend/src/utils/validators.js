export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateAuthForm(mode, values) {
  const errors = {};

  if (mode === "register") {
    if (!values.firstName.trim()) errors.firstName = "El nombre es obligatorio";
    if (!values.lastName.trim()) errors.lastName = "El apellido es obligatorio";
  }

  if (!values.email.trim()) {
    errors.email = "El email es obligatorio";
  } else if (!isValidEmail(values.email)) {
    errors.email = "Ingresa un email valido";
  }

  if (!values.password) {
    errors.password = "La contrasena es obligatoria";
  } else if (values.password.length < 6) {
    errors.password = "La contrasena debe tener al menos 6 caracteres";
  }

  return errors;
}
