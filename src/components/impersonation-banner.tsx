"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { roleLabels } from "@/lib/data";
import { getImpersonationReturnSession, returnToPlatformAdmin } from "@/lib/platform/impersonate";

export function ImpersonationBanner() {
  const { currentUser, isDemoMode } = useAuth();
  const [hasReturnSession, setHasReturnSession] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHasReturnSession(Boolean(getImpersonationReturnSession()));
    });
  }, [currentUser.id]);

  if (isDemoMode || !hasReturnSession || currentUser.platformAdmin) {
    return null;
  }

  async function handleReturn() {
    setReturning(true);
    const result = await returnToPlatformAdmin();
    setReturning(false);

    if (!result.ok) {
      return;
    }

    window.setTimeout(() => {
      window.location.href = "/plataforma";
    }, 0);
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950">
      <span>
        Modo suporte: voce esta vendo como {currentUser.name} ({roleLabels[currentUser.role]}).
      </span>
      <button
        onClick={handleReturn}
        disabled={returning}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-950 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"
      >
        <LogOut size={14} />
        {returning ? "Voltando..." : "Voltar para admin geral"}
      </button>
    </div>
  );
}
