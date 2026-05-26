"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { getVisibleCells } from "@/lib/access-control";
import { useCellReports, useCells, useLocalPeople } from "@/lib/local-store";
import { getCellStats } from "@/lib/reports";

export default function NewReportPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { addReport } = useCellReports();
  const visibleCells = getVisibleCells(currentUser, cells);
  const writableCells = visibleCells.filter((cell) => currentUser.role !== "supervisor" || cell.supervisorUserId === currentUser.id);
  const [selectedCellId, setSelectedCellId] = useState(writableCells[0]?.id ?? visibleCells[0]?.id ?? "");
  const [saved, setSaved] = useState("");

  const selectedCell = useMemo(
    () => cells.find((cell) => cell.id === selectedCellId) ?? writableCells[0] ?? visibleCells[0],
    [cells, selectedCellId, visibleCells, writableCells],
  );
  const stats = selectedCell ? getCellStats(selectedCell, people) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCell) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const report = await addReport({
      churchId: selectedCell.churchId,
      cellId: selectedCell.id,
      cellName: selectedCell.name,
      leaderUserId: selectedCell.leaderUserId,
      leaderName: selectedCell.leaderName,
      supervisorUserId: selectedCell.supervisorUserId,
      meetingDate: String(formData.get("meetingDate") || new Intl.DateTimeFormat("pt-BR").format(new Date())),
      presentCount: Number(formData.get("presentCount") || stats?.present || 0),
      visitorsCount: Number(formData.get("visitorsCount") || 0),
      serviceCount: Number(formData.get("serviceCount") || stats?.servicePresent || 0),
      decisionsCount: Number(formData.get("decisionsCount") || 0),
      highlights: String(formData.get("highlights") || "").trim(),
      needs: String(formData.get("needs") || "").trim(),
      prayerRequests: String(formData.get("prayerRequests") || "").trim(),
      persistToSupabase: !isDemoMode,
    });

    setSaved(`Relatorio de ${report.cellName} salvo para supervisao.`);
    event.currentTarget.reset();
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/relatorios"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </Link>
          <SectionHeader eyebrow="Relatorio" title="Nova reuniao de celula" />
        </div>

        {saved && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            {saved}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-400">Celula</span>
              <select
                value={selectedCellId}
                onChange={(event) => setSelectedCellId(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
              >
                {writableCells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name} - {cell.leaderName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-400">Data da reuniao</span>
              <input
                name="meetingDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-2 min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Presentes</span>
                <input
                  name="presentCount"
                  type="number"
                  min="0"
                  defaultValue={stats?.present ?? 0}
                  className="mt-2 min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Visitantes</span>
                <input
                  name="visitorsCount"
                  type="number"
                  min="0"
                  defaultValue="0"
                  className="mt-2 min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Foram ao culto</span>
                <input
                  name="serviceCount"
                  type="number"
                  min="0"
                  defaultValue={stats?.servicePresent ?? 0}
                  className="mt-2 min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Decisoes</span>
                <input
                  name="decisionsCount"
                  type="number"
                  min="0"
                  defaultValue="0"
                  className="mt-2 min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-400">Destaques da reuniao</span>
              <textarea
                name="highlights"
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="O que Deus fez? Quem participou bem? Algo importante aconteceu?"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-400">Necessidades de acompanhamento</span>
              <textarea
                name="needs"
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Quem precisa de mensagem, visita, discipulado ou conversa?"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-400">Pedidos de oracao</span>
              <textarea
                name="prayerRequests"
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Pedidos importantes para supervisor/pastor acompanharem."
              />
            </label>
          </div>

          <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/15">
            <ClipboardCheck size={18} />
            Salvar relatorio
          </button>
        </form>
      </section>
    </AppShell>
  );
}
