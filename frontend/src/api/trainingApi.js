const DEFAULT_ENGINE_BASE_URL = "http://localhost:8081";

const ENGINE_BASE_URL = (
  import.meta.env.VITE_MUSIC_ENGINE_BASE_URL || DEFAULT_ENGINE_BASE_URL
).replace(/\/$/, "");

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return response.json();
}

function normalizeApiError(statusCode, payload) {
  if (!payload || typeof payload !== "object") {
    return {
      statusCode,
      message: "Unexpected error",
      details: []
    };
  }

  return {
    statusCode,
    message: typeof payload.message === "string" ? payload.message : "Unexpected error",
    details: Array.isArray(payload.details) ? payload.details : []
  };
}

async function requestEngine(path, options = {}) {
  const response = await fetch(`${ENGINE_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw normalizeApiError(response.status, payload);
  }
  return payload;
}

export function createEngineSession(payload) {
  return requestEngine("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function sendBiometric(payload) {
  return requestEngine("/api/v1/biometrics", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
