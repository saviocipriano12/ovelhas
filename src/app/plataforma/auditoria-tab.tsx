"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, ScrollText } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { supabase } from "@/lib/supabase/client";

type AuditLogRow = {
  id: string;
  actor_name: string | null;
  action: string;
  target_church_id: string | null;
  target_church_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  create_church: "Criou a igreja",
  extend_trial: "Estendeu o teste gratis",
  add_note: "Registrou uma anotacao",
  impersonate: "Entrou como admin de",
  grant_lifetime: "Concedeu acesso vitalicio gratis",
  revoke_access: "Revogou o acesso",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function describeDetails(action: string, details: Record<string, unknown> | null) {
  if (!details) return null;

  if (action === "extend_trial" && typeof details.extra_days === "number") {
    return `+${details.extra_days} dias`;
  }

  if (action === "add_note" && typeof details.note === "string") {
    return `"${details.note}"`;
  }

  if (action === "create_church" && typeof details.admin_email === "string") {
    return `admin: ${details.admin_email}`;
  }

  if (action === "impersonate" && typeof details.target_user_name === "string") {
    return details.target_user_name;
  }

  return null;
}

export function AuditoriaTab() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase.rpc("platform_list_audit_log", { limit_count: 150 });
    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRows((data ?? []) as AuditLogRow[]);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Auditoria"
        title="Acoes do admin geral"
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

      {error && <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}
      {loading && (
        <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-800">Carregando...</div>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start gap-3 rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
              <ScrollText size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-950">
                {row.actor_name ?? "Admin geral"} - {ACTION_LABELS[row.action] ?? row.action}
                {row.target_church_name ? ` - ${row.target_church_name}` : ""}
              </p>
              {describeDetails(row.action, row.details) && (
                <p className="mt-1 text-sm font-semibold text-slate-500">{describeDetails(row.action, row.details)}</p>
              )}
              <p className="mt-1 text-[11px] font-bold uppercase text-slate-400">{formatDateTime(row.created_at)}</p>
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <p className="rounded-[24px] bg-white/90 p-5 text-center text-sm font-semibold text-slate-500">
            Nenhuma acao registrada ainda.
          </p>
        )}
      </div>
    </section>
  );
}
