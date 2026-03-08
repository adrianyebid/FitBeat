import { createContext, useContext, useMemo, useState } from "react";
import { login as loginRequest, register as registerRequest } from "../api/authApi";
import { mockUser, USE_MOCK_DATA } from "../api/mockData";

const USER_STORAGE_KEY = "fitbeat-user";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = readStoredUser();
    // En desarrollo, usar datos mock si no hay usuario guardado
    if (!stored && USE_MOCK_DATA) {
      persistUser(mockUser);
      return mockUser;
    }
    return stored;
  });

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      async login(form) {
        const result = await loginRequest(form);
        setUser(result.user);
        persistUser(result.user);
        return result;
      },
      async register(form) {
        const result = await registerRequest(form);
        setUser(result.user);
        persistUser(result.user);
        return result;
      },
      logout() {
        setUser(null);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }),
    [user]
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

