"use client";

import Link from "next/link";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { getVisibleCells } from "@/lib/access-control";
import { useCells, useLocalPeople } from "@/lib/local-store";
import { getCellStats } from "@/lib/reports";

export default function CellsPage() {
  const { currentUser } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const visibleCells = getVisibleCells(currentUser, cells);
  const visibleCellIds = new Set(visibleCells.map((cell) => cell.id));
  const visiblePeople = people.filter((person) => visibleCellIds.has(person.cellId));
  const attention = visiblePeople.filter((person) => person.cellAbsences >= 2 || person.progress < 20).length;

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow="Celulas" title="Acompanhamento por celula" />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={Users} label="Celulas" value={String(visibleCells.length)} accent="bg-emerald-500" />
          <MetricCard icon={Users} label="Pessoas" value={String(visiblePeople.length)} accent="bg-sky-500" />
          <MetricCard icon={CalendarClock} label="Atencao" value={String(attention)} accent="bg-amber-500" />
          <MetricCard icon={MapPin} label="Bairros" value={String(new Set(visibleCells.map((cell) => cell.neighborhood)).size)} accent="bg-violet-500" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {visibleCells.map((cell) => {
            const stats = getCellStats(cell, people);
            return (
              <article key={cell.id} className="rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-700">{cell.meetingDay}, {cell.meetingTime}</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">{cell.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">Lider: {cell.leaderName}</p>
                  </div>
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                    {stats.attendanceRate}%
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Pessoas</p>
                    <p className="mt-1 text-lg font-semibold">{stats.total}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Presentes</p>
                    <p className="mt-1 text-lg font-semibold">{stats.present}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Alertas</p>
                    <p className="mt-1 text-lg font-semibold">{stats.attention}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">Discipulado medio</span>
                    <span className="font-bold text-emerald-700">{stats.averageProgress}%</span>
                  </div>
                  <ProgressBar value={stats.averageProgress} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin size={15} className="shrink-0 text-emerald-700" />
                    <span className="truncate">{cell.neighborhood}</span>
                  </span>
                  <Link href="/relatorios/novo" className="font-bold text-emerald-800">
                    Novo relatorio
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {visibleCells.length === 0 && (
          <div className="rounded-lg border border-white/80 bg-white/90 p-5 text-center text-sm font-medium text-slate-500">
            Nenhuma celula visivel para este perfil.
          </div>
        )}
      </section>
    </AppShell>
  );
}
