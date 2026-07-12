"use client";

import { useCallback, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { User } from "@/types/ui";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

// Wraps next-auth/react's session so existing pages (which were built
// against a mock localStorage-based auth) keep the same interface
// (user, isLoading, isAuthenticated, login, logout, error) while now being
// backed by real Auth.js sessions + the Prisma `users` table.
export const useAuth = (): AuthContextType => {
  const { data: session, status } = useSession();

  const user: User | null = useMemo(() => {
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? "User",
      role: session.user.role,
      createdAt: new Date(),
    };
  }, [session]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      throw new Error("Invalid email or password");
    }
  }, []);

  // Awaited by callers (see handleLogout in the page components) so the
  // session cookie is actually cleared server-side before we navigate away.
  // Firing signOut() without awaiting it and then immediately forcing a
  // window.location navigation can abort the in-flight signOut request,
  // leaving a stale session cookie behind.
  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/login" });
  }, []);

  return {
    user,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    login,
    logout,
    error: null,
  };
};
