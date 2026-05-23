"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AppUser } from "@/lib/data";
import { users, type UserRole } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";

const AUTH_KEY = "ovelhas:current-user";

type AuthContextValue = {
  currentUser: AppUser;
  users: AppUser[];
  isDemoMode: boolean;
  isLoadingAuth: boolean;
  setCurrentUserId: (userId: string) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserIdState] = useState(users[3].id);
  const [supabaseUser, setSupabaseUser] = useState<AppUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      const stored = window.localStorage.getItem(AUTH_KEY);
      if (stored && users.some((user) => user.id === stored)) {
        setCurrentUserIdState(stored);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("id, church_id, name, role")
        .eq("id", userId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (data) {
        setSupabaseUser({
          id: data.id,
          name: data.name,
          role: data.role as UserRole,
          churchId: data.church_id ?? "sem-igreja",
        });
      } else {
        setSupabaseUser(null);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user) {
        loadProfile(user.id).finally(() => active && setIsLoadingAuth(false));
      } else {
        setSupabaseUser(null);
        setIsLoadingAuth(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) {
        loadProfile(user.id).finally(() => active && setIsLoadingAuth(false));
      } else {
        setSupabaseUser(null);
        setIsLoadingAuth(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const demoUser = users.find((user) => user.id === currentUserId) ?? users[3];
  const currentUser = supabaseUser ?? demoUser;
  const isDemoMode = !supabaseUser;

  function setCurrentUserId(userId: string) {
    setCurrentUserIdState(userId);
    window.localStorage.setItem(AUTH_KEY, userId);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSupabaseUser(null);
  }

  const value = useMemo(
    () => ({ currentUser, users, isDemoMode, isLoadingAuth, setCurrentUserId, signOut }),
    [currentUser, isDemoMode, isLoadingAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider");
  }

  return context;
}
