const AUTH_STORAGE_KEY = "fitbeat-auth";
const LEGACY_USER_STORAGE_KEY = "fitbeat-user";

export function readAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }

    // Compatibilidad con sesiones antiguas que solo guardaban user.
    const legacyRaw = localStorage.getItem(LEGACY_USER_STORAGE_KEY);
    if (!legacyRaw) {
      return null;
    }
    const legacyUser = JSON.parse(legacyRaw);
    if (!legacyUser) {
      return null;
    }

    return {
      user: legacyUser,
      accessToken: "",
      refreshToken: ""
    };
  } catch {
    return null;
  }
}

export function persistAuthSession(session) {
  const normalized = {
    user: session?.user || null,
    accessToken: session?.accessToken || "",
    refreshToken: session?.refreshToken || ""
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem(LEGACY_USER_STORAGE_KEY, JSON.stringify(normalized.user));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
}

export function getAccessToken() {
  const session = readAuthSession();
  return session?.accessToken || "";
}

export function getRefreshToken() {
  const session = readAuthSession();
  return session?.refreshToken || "";
}

export function updateStoredTokens({ accessToken, refreshToken }) {
  const session = readAuthSession();
  if (!session) {
    return;
  }

  persistAuthSession({
    ...session,
    accessToken: accessToken || session.accessToken || "",
    refreshToken: refreshToken || session.refreshToken || ""
  });
}
