import { createContext, useContext, useMemo, useState } from "react";
import {
  login as loginRequest,
  refreshSession as refreshSessionRequest,
  register as registerRequest
} from "../api/authApi";
import { mockUser, USE_MOCK_DATA } from "../api/mockData";
import { clearAuthSession, persistAuthSession, readAuthSession } from "../utils/authStorage";
import { clearMusicPreferences } from "../utils/musicPreferences";

const AuthContext = createContext(null);

function normalizeAuthResult(result) {
  const user = result?.user || null;
  const accessToken = result?.accessToken || result?.access_token || "";
  const refreshToken = result?.refreshToken || result?.refresh_token || "";

  if (!user) {
    throw new Error("Respuesta de autenticacion invalida: falta user.");
  }

  return {
    user,
    accessToken,
    refreshToken
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const stored = readAuthSession();
    if (stored?.user) {
      return stored;
    }

    // En desarrollo, usar datos mock si no hay sesion guardada
    if (USE_MOCK_DATA) {
      const mockSession = {
        user: mockUser,
        accessToken: "",
        refreshToken: ""
      };
      persistAuthSession(mockSession);
      return mockSession;
    }

    return null;
  });

  const value = useMemo(
    () => ({
      user: session?.user || null,
      accessToken: session?.accessToken || "",
      refreshToken: session?.refreshToken || "",
      isAuthenticated: Boolean(session?.user),
      async login(form) {
        const result = await loginRequest(form);
        const normalized = normalizeAuthResult(result);
        setSession(normalized);
        persistAuthSession(normalized);
        return result;
      },
      async register(form) {
        const result = await registerRequest(form);
        const normalized = normalizeAuthResult(result);
        setSession(normalized);
        persistAuthSession(normalized);
        return result;
      },
      async refreshAuthSession() {
        const tokens = await refreshSessionRequest();
        const current = readAuthSession();
        if (!current?.user) {
          return null;
        }
        const updated = {
          ...current,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        };
        setSession(updated);
        persistAuthSession(updated);
        return updated;
      },
      logout() {
        setSession(null);
        clearAuthSession();
        clearMusicPreferences();
      }
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
