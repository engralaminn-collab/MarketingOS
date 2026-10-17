"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { api, clearToken, setToken } from "@/lib/api-client";
import { useAppStore, type AuthUser as AppAuthUser } from "@/stores/app-store";

export interface AuthUser extends Omit<AppAuthUser, "avatar"> {
  avatar: string | null;
  isSuperAdmin: boolean;
  institutionId: string;
  institutionName: string;
}

interface LoginResponse {
  token: string;
  user: Omit<AuthUser, "token">;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

/**
 * The app uses a single Zustand-backed session store. This keeps academic
 * views that still call useAuth in sync with MarketingOS login/logout rather
 * than maintaining an unmounted, divergent React context.
 */
export function useAuth(): AuthContextType {
  const appUser = useAppStore((state) => state.user);
  const institution = useAppStore((state) => state.institution);
  const isLoading = useAppStore((state) => state.isLoading);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setAppUser = useAppStore((state) => state.setUser);
  const storeLogout = useAppStore((state) => state.logout);

  const logout = useCallback(() => {
    clearToken();
    if (typeof window !== "undefined") {
      localStorage.removeItem("alo_user");
      localStorage.removeItem("mos_user");
    }
    storeLogout();
  }, [storeLogout]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener("auth:logout", onUnauthorized);
    return () => window.removeEventListener("auth:logout", onUnauthorized);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResponse>("/api/auth/login", { email, password });
    setToken(result.token);
    setAppUser({
      ...result.user,
      avatar: result.user.avatar ?? undefined,
      token: result.token,
    });
  }, [setAppUser]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.post<LoginResponse>("/api/auth/register", { name, email, password });
    setToken(result.token);
    setAppUser({
      ...result.user,
      avatar: result.user.avatar ?? undefined,
      token: result.token,
    });
  }, [setAppUser]);

  const user: AuthUser | null = appUser ? {
    ...appUser,
    avatar: appUser.avatar ?? null,
    isSuperAdmin: appUser.role === "super_admin",
    institutionId: institution?.id ?? "",
    institutionName: institution?.name ?? "",
  } : null;

  return { user, isLoading, isAuthenticated, login, register, logout };
}

/** Backwards-compatible wrapper; state is owned by the shared app store. */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
