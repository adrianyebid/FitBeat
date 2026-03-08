import { request } from "./httpClient";

//Pend a integración con el backend para guardar sesiones de entrenamiento, obtener sesiones y estadísticas de entrenamiento.

export function saveTrainingSession(payload) {
  return request("/api/training/sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getTrainingSessions() {
  return request("/api/training/sessions", {
    method: "GET"
  });
}

export function getTrainingStats(userId) {
  return request(`/api/training/stats/${userId}`, {
    method: "GET"
  });
}
