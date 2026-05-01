const DEFAULT_ACHIEVEMENTS_API_URL = "http://localhost:8082";

const ACHIEVEMENTS_API_URL = (
  import.meta.env.VITE_ACHIEVEMENTS_API_URL || DEFAULT_ACHIEVEMENTS_API_URL
).replace(/\/$/, "");

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

function normalizeError(statusCode, payload) {
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

async function request(path, options = {}) {
  const response = await fetch(`${ACHIEVEMENTS_API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw normalizeError(response.status, payload);
  }

  return payload;
}

export function getAchievementsCatalog() {
  return request("/achievements/catalog", { method: "GET" });
}

export function getUserAchievements(userId) {
  return request(`/achievements/user/${encodeURIComponent(userId)}`, { method: "GET" });
}

export function evaluateAchievements(payload) {
  return request("/achievements/evaluate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
