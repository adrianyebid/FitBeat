import { getAccessToken } from "../utils/authStorage";

const DEFAULT_AUTH_API_URL = "http://localhost:8000";

export const AUTH_API_URL = (
  import.meta.env.VITE_AUTH_API_URL || DEFAULT_AUTH_API_URL
).replace(/\/$/, "");

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

function normalizeFastApiDetail(detail) {
  if (!detail) {
    return null;
  }

  if (typeof detail === "string") {
    return {
      message: detail,
      details: []
    };
  }

  if (Array.isArray(detail)) {
    const detailLines = detail
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const path = Array.isArray(item.loc) ? item.loc.join(".") : "body";
        const msg = item.msg || "invalid field";
        return `${path}: ${msg}`;
      })
      .filter(Boolean);

    return {
      message: "validation failed",
      details: detailLines
    };
  }

  if (typeof detail === "object") {
    return {
      message: detail.message || "Unexpected error",
      details: Array.isArray(detail.details) ? detail.details : []
    };
  }

  return null;
}

function normalizeApiError(statusCode, payload) {
  if (!payload || typeof payload !== "object") {
    return {
      statusCode,
      message: "Unexpected error",
      details: []
    };
  }

  if ("detail" in payload) {
    const normalizedDetail = normalizeFastApiDetail(payload.detail);
    if (normalizedDetail) {
      return {
        statusCode,
        ...normalizedDetail
      };
    }
  }

  return {
    statusCode,
    message: typeof payload.message === "string" ? payload.message : "Unexpected error",
    details: Array.isArray(payload.details) ? payload.details : []
  };
}

export async function request(path, options = {}) {
  const { auth = true, headers = {}, ...restOptions } = options;
  const token = auth ? getAccessToken() : "";

  const response = await fetch(`${AUTH_API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...restOptions
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw normalizeApiError(response.status, payload);
  }

  return payload;
}
