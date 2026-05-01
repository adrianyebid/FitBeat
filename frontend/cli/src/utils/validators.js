/**
 * Validation utilities for CLI input
 */

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Debes ingresar un correo';
  }
  if (!isValidEmail(trimmed)) {
    return 'Ingresa un correo válido';
  }
  return true;
}

export function validatePassword(value) {
  if (!value) {
    return 'Debes ingresar una contraseña';
  }
  if (value.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres';
  }
  return true;
}

export function validateRequired(fieldName) {
  return (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return `Debes ingresar ${fieldName}`;
    }
    return true;
  };
}

// Made with Bob
