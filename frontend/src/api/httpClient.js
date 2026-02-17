const DEFAULT_BASE_URL = "http://localhost:8080";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

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

  const details = Array.isArray(payload.details) ? payload.details : [];
  const message = typeof payload.message === "string" ? payload.message : "Unexpected error";

  return {
    statusCode,
    message,
    details
  };
}

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
