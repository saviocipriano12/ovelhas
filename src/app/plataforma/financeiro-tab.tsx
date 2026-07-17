"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCcw, Wallet } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { supabase } from "@/lib/supabase/client";
import { SUBSCRIPTION_PLANS, isSubscriptionTier, type SubscriptionTier } from "@/lib/subscription-plans";

type PlatformSubscriptionRow = {
  church_id: string;
  church_name: string;
  tier: string | null;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string | null;
  people_count: number;
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Em teste gratis",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  canceled: "Cancelada",
  incomplete: "Aguardando pagamento",
  incomplete_expired: "Expirada sem pagamento",
  unpaid: "Nao paga",
  sem_assinatura: "Sem assinatura",
  lifetime: "Cortesia (vitalicia)",
};

function statusTone(status: string) {
  if (status === "lifetime") return "bg-violet-100 text-violet-800";
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "trialing") return "bg-sky-100 text-sky-800";
  if (status === "past_due" || status === "unpaid") return "bg-amber-100 text-amber-900";
  if (status === "canceled" || status === "incomplete_expired") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-500";
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function FinanceiroTab() {
  const [rows, setRows] = useState<PlatformSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase.rpc("platform_list_subscriptions");
    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRows((data ?? []) as PlatformSubscriptionRow[]);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  const mrrCents = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (row.status !== "active" || !isSubscriptionTier(row.tier)) {
          return sum;
        }
        return sum + SUBSCRIPTION_PLANS[row.tier as SubscriptionTier].priceCents;
      }, 0),
    [rows],
  );

  const counts = useMemo(() => {
    const result = { active: 0, trialing: 0, pastDue: 0, blocked: 0 };
    for (const row of rows) {
      if (row.status === "active") result.active += 1;
      else if (row.status === "trialing") result.trialing += 1;
      else if (row.status === "past_due" || row.status === "unpaid") result.pastDue += 1;
      else if (row.status === "canceled" || row.status === "incomplete_expired") result.blocked += 1;
    }
    return result;
  }, [rows]);

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Financeiro"
        title="Receita e assinaturas"
        action={
          <button
            onClick={load}
            className="flex min-h-10 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-slate-700 shadow-sm"
          >
            <RefreshCcw size={15} />
            Atualizar
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[24px] bg-slate-950 p-4 text-white">
          <Wallet size={20} className="text-emerald-200" />
          <p className="mt-3 text-2xl font-black">{formatCents(mrrCents)}</p>
          <p className="text-sm font-semibold text-slate-300">MRR (assinaturas ativas)</p>
        </div>
        <div className="rounded-[24px] bg-white/90 p-4 shadow-sm">
          <p className="mt-3 text-3xl font-black text-emerald-700">{counts.active}</p>
          <p className="text-sm font-semibold text-slate-500">Ativas</p>
        </div>
        <div className="rounded-[24px] bg-white/90 p-4 shadow-sm">
          <p className="mt-3 text-3xl font-black text-sky-700">{counts.trialing}</p>
          <p className="text-sm font-semibold text-slate-500">Em teste</p>
        </div>
        <div className="rounded-[24px] bg-white/90 p-4 shadow-sm">
          <p className="mt-3 text-3xl font-black text-amber-700">{counts.pastDue}</p>
          <p className="text-sm font-semibold text-slate-500">Atrasadas</p>
        </div>
      </div>

      {counts.pastDue > 0 && (
        <div className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <p>{counts.pastDue} igreja(s) com pagamento atrasado. Fique de olho antes que o acesso seja bloqueado automaticamente.</p>
        </div>
      )}

      {error && <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}
      {loading && (
        <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-800">
          Carregando assinaturas...
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.church_id} className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-slate-950">{row.church_name}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {row.tier ? SUBSCRIPTION_PLANS[row.tier as SubscriptionTier]?.label ?? row.tier : "Sem plano"} - {row.people_count} pessoa(s)
                </p>
              </div>
              <span className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-black ${statusTone(row.status)}`}>
                {STATUS_LABELS[row.status] ?? row.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
              {row.status === "trialing" && formatDate(row.trial_ends_at) && <span>Teste ate {formatDate(row.trial_ends_at)}</span>}
              {row.current_period_end && (
                <span>{row.cancel_at_period_end ? "Cancela em" : "Renova em"} {formatDate(row.current_period_end)}</span>
              )}
            </div>
          </article>
        ))}
        {!loading && rows.length === 0 && (
          <p className="rounded-[24px] bg-white/90 p-5 text-center text-sm font-semibold text-slate-500">
            Nenhuma igreja com assinatura ainda.
          </p>
        )}
      </div>
    </section>
  );
}
