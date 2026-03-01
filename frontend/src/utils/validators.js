export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateAuthForm(mode, values) {
  const errors = {};

  if (mode === "register") {
    if (!values.firstName.trim()) errors.firstName = "Debes ingresar un nombre";
    if (!values.lastName.trim()) errors.lastName = "Debes ingresar un apellido";
  }

  if (!values.email.trim()) {
    errors.email = "Debes ingresar un correo";
  } else if (!isValidEmail(values.email)) {
    errors.email = "Ingresa un correo válido";
  }

  if (!values.password) {
    errors.password = "Debes ingresar una contraseña";
  } else if (values.password.length < 6) {
    errors.password = "La contraseña debe tener al menos 6 caracteres";
  }

  return errors;
}
