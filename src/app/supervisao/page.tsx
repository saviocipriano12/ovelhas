"use client";

import { FormEvent, useState } from "react";
import { ClipboardCheck, Eye, Route, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { getScopedCells, getScopedSupervisorVisits } from "@/lib/access-control";
import { useActivityEvents, useCells, useLocalPeople, useSupervisorVisits } from "@/lib/local-store";
import { getCellStats } from "@/lib/reports";

function isThisWeek(dateValue: string) {
  const [day, month, year] = dateValue.includes("/") ? dateValue.split("/").map(Number) : [];
  const date = year ? new Date(year, month - 1, day) : new Date(dateValue);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

export default function SupervisionPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { people } = useLocalPeople();
  const { visits, addVisit } = useSupervisorVisits();
  const { addEvent } = useActivityEvents();
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleVisits = getScopedSupervisorVisits(currentUser, visits, cells, isDemoMode);
  const supervisorCells = visibleCells.filter((cell) =>
    currentUser.role === "supervisor" ? cell.supervisorUserId === currentUser.id || currentUser.cellIds?.includes(cell.id) : true,
  );
  const [selectedCellId, setSelectedCellId] = useState(supervisorCells[0]?.id ?? visibleCells[0]?.id ?? "");
  const [saved, setSaved] = useState("");

  const selectedCell = cells.find((cell) => cell.id === selectedCellId) ?? supervisorCells[0] ?? visibleCells[0];

  const visitedThisWeek = visibleVisits.filter((visit) => isThisWeek(visit.visitDate)).length;
  const pendingCells = visibleCells.filter(
    (cell) => !visibleVisits.some((visit) => visit.cellId === cell.id && isThisWeek(visit.visitDate)),
  );
  const averageHealth = visibleVisits.length
    ? Math.round(visibleVisits.reduce((sum, visit) => sum + visit.healthScore, 0) / visibleVisits.length)
    : 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCell) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const visit = await addVisit({
      churchId: selectedCell.churchId,
      cellId: selectedCell.id,
      cellName: selectedCell.name,
      supervisorUserId: currentUser.id,
      supervisorName: currentUser.name,
      leaderUserId: selectedCell.leaderUserId,
      leaderName: selectedCell.leaderName,
      visitDate: String(formData.get("visitDate") || new Intl.DateTimeFormat("pt-BR").format(new Date())),
      visitType: String(formData.get("visitType") || "Presencial") as "Presencial" | "Online" | "Ligacao",
      leaderPresent: formData.get("leaderPresent") === "on",
      healthScore: Number(formData.get("healthScore") || 80),
      notes: String(formData.get("notes") || "").trim(),
      nextSteps: String(formData.get("nextSteps") || "").trim(),
      persistToSupabase: !isDemoMode,
    });

    await addEvent({
      churchId: selectedCell.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Registrou supervisao",
      description: `${currentUser.name} acompanhou a celula ${selectedCell.name}. Saude percebida: ${visit.healthScore}%.`,
      targetType: "visit",
      targetId: visit.id,
      targetName: selectedCell.name,
      cellId: selectedCell.id,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setSaved(`Supervisao de ${selectedCell.name} registrada para o pastor acompanhar.`);
    event.currentTarget.reset();
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow="Supervisao" title="Acompanhamento das celulas" />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={Route} label="Celulas" value={String(visibleCells.length)} accent="bg-emerald-500" />
          <MetricCard icon={Eye} label="Visitadas" value={String(visitedThisWeek)} accent="bg-sky-500" />
          <MetricCard icon={ClipboardCheck} label="Pendentes" value={String(pendingCells.length)} accent="bg-amber-500" />
          <MetricCard icon={Users} label="Saude media" value={`${averageHealth}%`} accent="bg-violet-500" />
        </div>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Semana" title="Cobertura do supervisor" />
          <div className="space-y-3">
            {visibleCells.map((cell) => {
              const stats = getCellStats(cell, people);
              const lastVisit = visibleVisits.find((visit) => visit.cellId === cell.id);
              const visited = Boolean(lastVisit && isThisWeek(lastVisit.visitDate));
              return (
                <article key={cell.id} className="rounded-lg bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{cell.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Lider: {cell.leaderName}</p>
                    </div>
                    <span className={`rounded-lg px-2 py-1 text-xs font-bold ${visited ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                      {visited ? "Visitada" : "Pendente"}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-600">Discipulado medio</span>
                      <span className="font-bold text-emerald-700">{stats.averageProgress}%</span>
                    </div>
                    <ProgressBar value={stats.averageProgress} />
                  </div>
                  {lastVisit && (
                    <p className="mt-3 text-sm leading-5 text-slate-500">
                      Ultima supervisao: {lastVisit.visitDate} - {lastVisit.nextSteps}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {currentUser.role !== "member" && (
          <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Registrar" title="Visita ou acompanhamento" />
            {saved && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{saved}</p>}
            <div className="space-y-3">
              <select
                value={selectedCellId}
                onChange={(event) => setSelectedCellId(event.target.value)}
                className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
              >
                {supervisorCells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name} - {cell.leaderName}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="visitDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="min-h-12 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
                <select
                  name="visitType"
                  className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option>Presencial</option>
                  <option>Online</option>
                  <option>Ligacao</option>
                </select>
              </div>
              <label className="flex min-h-12 items-center gap-3 rounded-lg bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                <input name="leaderPresent" type="checkbox" defaultChecked className="h-5 w-5 accent-emerald-700" />
                Lider participou da supervisao
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Saude percebida da celula</span>
                <input name="healthScore" type="range" min="0" max="100" defaultValue="80" className="mt-3 w-full accent-emerald-700" />
              </label>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="O que foi observado na celula?"
              />
              <textarea
                name="nextSteps"
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Proximos passos combinados com o lider"
              />
            </div>
            <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
              <ClipboardCheck size={18} />
              Salvar supervisao
            </button>
          </form>
        )}
      </section>
    </AppShell>
  );
}
