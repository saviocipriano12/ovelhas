"use client";

import { Activity, Crown, Eye, UserCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { SectionHeader } from "@/components/section-header";
import { getScopedActivityEvents } from "@/lib/access-control";
import { useActivityEvents, useCells, useLocalPeople } from "@/lib/local-store";
import { roleLabels } from "@/lib/data";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ActivitiesPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { events } = useActivityEvents();
  const { cells } = useCells();
  const { people } = useLocalPeople();
  const visibleEvents = getScopedActivityEvents(currentUser, events, cells, people, isDemoMode).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const leaderEvents = visibleEvents.filter((event) => event.actorRole === "leader").length;
  const supervisorEvents = visibleEvents.filter((event) => event.actorRole === "supervisor").length;
  const memberEvents = visibleEvents.filter((event) => event.actorRole === "member").length;

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Prestacao de contas" />

        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-950">Inteligencia de acompanhamento</p>
          <p className="mt-1 text-sm leading-5 text-emerald-800">
            Esta tela mostra movimento: relatorios enviados, supervisoes registradas, discipulado iniciado e cuidados feitos.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={Activity} label="Eventos" value={String(visibleEvents.length)} accent="bg-emerald-500" />
          <MetricCard icon={Crown} label="Lideres" value={String(leaderEvents)} accent="bg-sky-500" />
          <MetricCard icon={Eye} label="Supervisores" value={String(supervisorEvents)} accent="bg-amber-500" />
          <MetricCard icon={UserCheck} label="Membros" value={String(memberEvents)} accent="bg-violet-500" />
        </div>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Linha do tempo" title="O que aconteceu" />
          <div className="space-y-3">
            {visibleEvents.map((event) => (
              <article key={event.id} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{event.action}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {event.actorName} - {roleLabels[event.actorRole]} - {formatDate(event.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600">
                    {event.targetType}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-5 text-slate-600">{event.description}</p>
                {event.targetName && (
                  <p className="mt-2 text-xs font-bold uppercase text-emerald-700">{event.targetName}</p>
                )}
              </article>
            ))}
            {visibleEvents.length === 0 && (
              <p className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-500">
                Nenhuma atividade visivel para este perfil.
              </p>
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
