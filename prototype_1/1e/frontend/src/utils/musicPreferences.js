/**
 * NOTA: Las preferencias musicales ahora se almacenan SOLO en la BD.
 * Este archivo se mantiene por compatibilidad, pero las funciones
 * principales ya no se usan. El frontend carga preferencias directamente
 * desde la BD usando getUserInfo().
 */

export function clearMusicPreferences() {
  // Por si acaso, limpiar localStorage (por compatibilidad)
  try {
    localStorage.removeItem("musicPreferences");
  } catch (error) {
    console.error("Error al limpiar musicPreferences de localStorage:", error);
  }
}
