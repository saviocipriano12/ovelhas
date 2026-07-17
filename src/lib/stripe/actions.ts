"use client";

import { supabase } from "@/lib/supabase/client";
import type { SubscriptionTier } from "@/lib/subscription-plans";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function startCheckout(churchId: string, tier: SubscriptionTier) {
  const headers = await authHeader();
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ churchId, tier }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false as const, error: data.error ?? "Nao foi possivel iniciar o checkout." };
  }

  return { ok: true as const, url: data.url as string };
}

export async function openBillingPortal(churchId: string) {
  const headers = await authHeader();
  const response = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ churchId }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false as const, error: data.error ?? "Nao foi possivel abrir o portal de pagamento." };
  }

  return { ok: true as const, url: data.url as string };
}
