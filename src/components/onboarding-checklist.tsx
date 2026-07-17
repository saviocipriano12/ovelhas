"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, PartyPopper, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getScopedCells, getScopedPeople } from "@/lib/access-control";
import { useCells, useChurchSettings, useChurchSubscription, useInvites, useLocalPeople } from "@/lib/local-store";
import { isSubscriptionBlocked } from "@/lib/subscription-plans";

function dismissKey(churchId: string) {
  return `ovelhas:onboarding-dismissed:${churchId}`;
}

export function OnboardingChecklist() {
  const { currentUser, isDemoMode } = useAuth();
  const { settings } = useChurchSettings(currentUser.churchId);
  const { cells } = useCells();
  const { people } = useLocalPeople();
  const { invites } = useInvites();
  const { subscription } = useChurchSubscription(currentUser.churchId);
  const [dismissed, setDismissed] = useState(true);

  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);

  useEffect(() => {
    queueMicrotask(() => {
      setDismissed(window.localStorage.getItem(dismissKey(currentUser.churchId)) === "1");
    });
  }, [currentUser.churchId]);

  const canManage = currentUser.role === "admin" || currentUser.role === "pastor";
  if (!canManage || isDemoMode || dismissed) {
    return null;
  }

  const steps = [
    { label: "Personalizar a identidade da igreja", done: Boolean(settings.logoUrl), href: "/configuracoes" },
    { label: "Criar a primeira celula", done: visibleCells.length > 0, href: "/celulas" },
    { label: "Convidar um lider ou supervisor", done: invites.some((invite) => invite.role !== "member"), href: "/convites" },
    { label: "Cadastrar as primeiras pessoas", done: visiblePeople.length > 0, href: "/pessoas" },
    {
      label: "Assinar um plano",
      done: Boolean(subscription) && !isSubscriptionBlocked(subscription?.status) && subscription?.status !== "incomplete",
      href: "/assinatura",
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) {
    return null;
  }

  function dismiss() {
    window.localStorage.setItem(dismissKey(currentUser.churchId), "1");
    setDismissed(true);
  }

  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <PartyPopper size={18} className="text-emerald-800" />
          <div>
            <p className="text-sm font-black uppercase text-emerald-800">Primeiros passos</p>
            <p className="text-xs font-semibold text-emerald-700">{doneCount} de {steps.length} concluidos</p>
          </div>
        </div>
        <button onClick={dismiss} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-emerald-800" aria-label="Fechar">
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-white/50"
          >
            {step.done ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-700" />
            ) : (
              <Circle size={16} className="shrink-0 text-emerald-400" />
            )}
            <span className={step.done ? "line-through opacity-60" : ""}>{step.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
