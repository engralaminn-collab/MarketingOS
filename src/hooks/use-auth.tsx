"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api, setToken, clearToken } from "@/lib/api-client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  isSuperAdmin: boolean;
  role: string;
  institutionId: string;
  institutionName: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_USER_KEY = "alo_user";

function persistUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
}

function loadPersistedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadPersistedUser();
  const [user, setUser] = useState<AuthUser | null>(initial);
  const [isLoading] = useState(false);

  const applyAuth = useCallback(
    (res: LoginResponse) => {
      setToken(res.token);
      persistUser(res.user);
      setUser(res.user);
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<LoginResponse>("/api/auth/login", { email, password });
      applyAuth(res);
    },
    [applyAuth]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.post<LoginResponse>("/api/auth/register", { name, email, password });
      applyAuth(res);
    },
    [applyAuth]
  );

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    window.location.reload();
  }, []);

  // Verify token on mount
  useEffect(() => {
    if (initial) {
      api.get<AuthUser>("/api/auth/me").then((data) => {
        if (data) {
          persistUser(data);
          setUser(data);
        } else {
          clearToken();
          localStorage.removeItem(STORAGE_USER_KEY);
          setUser(null);
        }
      }).catch(() => {
        clearToken();
        localStorage.removeItem(STORAGE_USER_KEY);
        setUser(null);
      });
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}