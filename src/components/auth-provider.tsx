"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessRoute, getDefaultRoute } from "@/lib/access-control";
import type { AppUser } from "@/lib/data";
import { users, type UserRole } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";

const AUTH_KEY = "ovelhas:current-user";
const PENDING_INVITE_KEY = "ovelhas:pending-invite-token";

type AuthContextValue = {
  currentUser: AppUser;
  users: AppUser[];
  isDemoMode: boolean;
  isLoadingAuth: boolean;
  setCurrentUserId: (userId: string) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const publicRoutes = ["/login", "/convite", "/offline"];

type CurrentAppUserProfile = {
  id?: string;
  church_id?: string | null;
  name?: string | null;
  role?: UserRole | null;
  person_id?: string | null;
  cell_ids?: string[] | null;
};

function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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

    async function loadPlatformAdminFlag(userId: string) {
      const { data, error } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        return false;
      }

      return Boolean(data);
    }

    async function loadProfile(user: { id: string; email?: string | null; user_metadata?: { name?: string } }) {
      const pendingInviteToken =
        typeof window !== "undefined" ? window.localStorage.getItem(PENDING_INVITE_KEY) : null;

      if (pendingInviteToken) {
        const { error } = await supabase.rpc("accept_invite", { invite_token: pendingInviteToken });

        if (!error && typeof window !== "undefined") {
          window.localStorage.removeItem(PENDING_INVITE_KEY);
        }
      }

      const { data: rpcData } = await supabase.rpc("current_app_user");
      const rpcProfile = rpcData as CurrentAppUserProfile | null;

      if (!active) {
        return;
      }

      if (rpcProfile?.id) {
        const platformAdmin = await loadPlatformAdminFlag(rpcProfile.id);

        setSupabaseUser({
          id: rpcProfile.id,
          name: rpcProfile.name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Usuario",
          role: (rpcProfile.role ?? "member") as UserRole,
          churchId: rpcProfile.church_id ?? "sem-igreja",
          platformAdmin,
          cellIds: rpcProfile.cell_ids ?? [],
          personId: rpcProfile.person_id ?? undefined,
        });
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, church_id, name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      const profileRole = (data?.role ?? "member") as UserRole;
      const churchId = data?.church_id ?? "sem-igreja";
      const [cellResult, personResult] = await Promise.all([
        data?.church_id
          ? supabase
              .from("cells")
              .select("id")
              .or(`leader_id.eq.${user.id},supervisor_id.eq.${user.id}`)
              .eq("church_id", data.church_id)
          : Promise.resolve({ data: [] as { id: string }[] }),
        data?.church_id
          ? supabase
              .from("people")
              .select("id, cell_id")
              .eq("person_user_id", user.id)
              .eq("church_id", data.church_id)
              .maybeSingle()
          : Promise.resolve({ data: null as { id: string; cell_id: string | null } | null }),
      ]);

      if (!active) {
        return;
      }

      const cellIds = Array.from(
        new Set([
          ...((cellResult.data ?? []) as { id: string }[]).map((cell) => cell.id),
          personResult.data?.cell_id ?? "",
        ].filter(Boolean)),
      );
      const platformAdmin = await loadPlatformAdminFlag(user.id);

      setSupabaseUser({
        id: user.id,
        name: data?.name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Usuario",
        role: profileRole,
        churchId,
        platformAdmin,
        cellIds,
        personId: personResult.data?.id,
      });
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user) {
        loadProfile(user).finally(() => active && setIsLoadingAuth(false));
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
        loadProfile(user).finally(() => active && setIsLoadingAuth(false));
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

  useEffect(() => {
    if (isLoadingAuth || supabaseUser || isPublicRoute(pathname)) {
      return;
    }

    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoadingAuth, pathname, router, supabaseUser]);

  useEffect(() => {
    if (isLoadingAuth || !supabaseUser || pathname !== "/login") {
      return;
    }

    router.replace(getDefaultRoute(supabaseUser));
  }, [isLoadingAuth, pathname, router, supabaseUser]);

  useEffect(() => {
    if (isLoadingAuth || !supabaseUser || isPublicRoute(pathname)) {
      return;
    }

    if (!canAccessRoute(supabaseUser, pathname)) {
      router.replace(getDefaultRoute(supabaseUser));
    }
  }, [isLoadingAuth, pathname, router, supabaseUser]);

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

  const blockedProtectedRoute = !isLoadingAuth && !supabaseUser && !isPublicRoute(pathname);
  const blockedByRole = !isLoadingAuth && Boolean(supabaseUser) && !isPublicRoute(pathname) && !canAccessRoute(currentUser, pathname);

  return (
    <AuthContext.Provider value={value}>
      {isLoadingAuth || blockedProtectedRoute || blockedByRole ? (
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8f3] px-6 text-center text-slate-900">
          <div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-xl font-black text-white shadow-lg shadow-emerald-900/20">
              O
            </div>
            <p className="mt-4 text-sm font-bold text-emerald-800">Ovelhas</p>
            <p className="mt-2 text-sm text-slate-500">
              {isLoadingAuth ? "Verificando acesso..." : blockedByRole ? "Ajustando area permitida..." : "Redirecionando para login..."}
            </p>
          </div>
        </main>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider");
  }

  return context;
}
