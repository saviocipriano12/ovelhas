"use client";

import { supabase } from "@/lib/supabase/client";

const RETURN_SESSION_KEY = "ovelhas_platform_return_session";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getImpersonationReturnSession(): { access_token: string; refresh_token: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(RETURN_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function impersonateChurchAdmin(churchId: string, targetUserId: string) {
  const { data: currentSession } = await supabase.auth.getSession();
  const headers = await authHeader();

  const response = await fetch("/api/plataforma/impersonate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ churchId, targetUserId }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false as const, error: data.error ?? "Nao foi possivel entrar como este administrador." };
  }

  if (currentSession.session && typeof window !== "undefined") {
    window.sessionStorage.setItem(
      RETURN_SESSION_KEY,
      JSON.stringify({
        access_token: currentSession.session.access_token,
        refresh_token: currentSession.session.refresh_token,
      }),
    );
  }

  await supabase.auth.setSession({ access_token: data.accessToken, refresh_token: data.refreshToken });

  return { ok: true as const, adminName: data.adminName as string };
}

export async function returnToPlatformAdmin() {
  const saved = getImpersonationReturnSession();
  if (!saved) {
    return { ok: false as const, error: "Sessao do admin geral nao encontrada. Faca login novamente." };
  }

  const { error } = await supabase.auth.setSession(saved);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(RETURN_SESSION_KEY);
  }

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
}
