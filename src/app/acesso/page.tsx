"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { SupabaseStatus } from "@/components/supabase-status";
import { describeAccess } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";

export default function AccessPage() {
  const { currentUser, users, isDemoMode, setCurrentUserId } = useAuth();

  return (
    <AppShell>
      <section className="animate-enter space-y-4">
        <SectionHeader eyebrow="Permissoes" title="Simulador de acesso" />

        <SupabaseStatus />

        <div className={`rounded-lg border p-4 text-sm font-semibold ${isDemoMode ? "border-amber-100 bg-amber-50 text-amber-900" : "border-emerald-100 bg-emerald-50 text-emerald-900"}`}>
          {isDemoMode ? (
            <p>
              Voce esta no modo demonstracao. Para usar uma conta real, acesse{" "}
              <Link href="/login" className="underline">
                /login
              </Link>
              .
            </p>
          ) : (
            <p>Voce esta usando uma sessao real do Supabase.</p>
          )}
        </div>

        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-950">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold">Perfil atual: {currentUser.name}</p>
              <p className="mt-1 text-sm leading-5 text-emerald-800">{describeAccess(currentUser)}</p>
              <p className="mt-2 text-xs font-bold uppercase text-emerald-700">Ovelhas by Savio Cipriano</p>
            </div>
          </div>
        </div>

        <div className={`grid gap-3 md:grid-cols-2 ${isDemoMode ? "" : "opacity-60"}`}>
          {users.map((user) => {
            const active = user.id === currentUser.id;
            return (
              <button
                key={user.id}
                onClick={() => setCurrentUserId(user.id)}
                disabled={!isDemoMode}
                className={`rounded-lg border p-4 text-left shadow-sm disabled:cursor-not-allowed ${
                  active
                    ? "border-emerald-300 bg-emerald-900 text-white"
                    : "border-white/80 bg-white/90 text-slate-900 hover:border-emerald-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className={`mt-1 text-sm ${active ? "text-emerald-100" : "text-slate-500"}`}>
                      {roleLabels[user.role]}
                    </p>
                  </div>
                  {active && <CheckCircle2 size={20} />}
                </div>
                <p className={`mt-3 text-sm leading-5 ${active ? "text-emerald-50" : "text-slate-500"}`}>
                  {describeAccess(user)}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
