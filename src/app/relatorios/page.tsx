"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, CheckCircle2, Church, Clipboard, Download, FileText, Plus, Sparkles, UserRoundPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { getScopedCells, getScopedPeople } from "@/lib/access-control";
import { useCellReports, useCells, useConsolidationReports, useLocalPeople } from "@/lib/local-store";
import { buildReportSummary, downloadReportHtml } from "@/lib/report-export";
import { getCellStats, getOverallStats } from "@/lib/reports";

export default function ReportsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { reports } = useCellReports();
  const { reports: consolidationReports } = useConsolidationReports(currentUser.churchId);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const overall = getOverallStats(visibleCells, visiblePeople);
  const visibleCellIds = new Set(visibleCells.map((cell) => cell.id));
  const visibleReports = reports.filter((report) => visibleCellIds.has(report.cellId));
  const consolidationTotals = consolidationReports.reduce(
    (totals, report) => ({
      visitors: totals.visitors + report.visitorsCount,
      decisions: totals.decisions + report.acceptedJesusCount + report.baptismDecisionCount,
    }),
    { visitors: 0, decisions: 0 },
  );

  function handleDownload() {
    downloadReportHtml({
      user: currentUser,
      cells: visibleCells,
      people: visiblePeople,
      reports: visibleReports,
      consolidationReports,
    });
  }

  async function handleCopySummary() {
    const summary = buildReportSummary({
      user: currentUser,
      cells: visibleCells,
      people: visiblePeople,
      reports: visibleReports,
      consolidationReports,
    });

    await navigator.clipboard.writeText(summary);
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow="Relatorios"
          title="Saude das celulas"
          action={
            <Link
              href="/relatorios/novo"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm"
              aria-label="Novo relatorio"
            >
              <Plus size={18} />
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <MetricCard icon={Church} label="Celulas" value={String(overall.cells)} accent="bg-emerald-500" />
          <MetricCard icon={Users} label="Pessoas" value={String(overall.people)} accent="bg-sky-500" />
          <MetricCard icon={CheckCircle2} label="No culto" value={String(overall.servicePresent)} accent="bg-violet-500" />
          <MetricCard icon={AlertTriangle} label="Atencao" value={String(overall.attention)} accent="bg-amber-500" />
          <MetricCard icon={UserRoundPlus} label="Visitantes" value={String(consolidationTotals.visitors)} accent="bg-emerald-500" />
          <MetricCard icon={Sparkles} label="Decisoes" value={String(consolidationTotals.decisions)} accent="bg-orange-500" />
        </div>

        <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-950">Relatorio pronto para compartilhar</p>
              <p className="mt-1 text-sm leading-5 text-emerald-800">
                Baixe um HTML bonito para anexar, salvar ou imprimir como PDF.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                onClick={handleCopySummary}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-bold text-emerald-900"
              >
                <Clipboard size={17} />
                Copiar
              </button>
              <button
                onClick={handleDownload}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-3 text-sm font-bold text-white shadow-sm"
              >
                <Download size={17} />
                Baixar
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Consolidado" title="Indicadores principais" />
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">Presenca nas celulas</span>
                <span className="font-bold text-emerald-700">
                  {overall.people ? Math.round((overall.present / overall.people) * 100) : 0}%
                </span>
              </div>
              <ProgressBar value={overall.people ? Math.round((overall.present / overall.people) * 100) : 0} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">Progresso no discipulado</span>
                <span className="font-bold text-emerald-700">{overall.averageProgress}%</span>
              </div>
              <ProgressBar value={overall.averageProgress} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Recentes" title="Relatorios enviados" />
          <div className="space-y-3">
            {visibleReports.slice(0, 5).map((report) => (
              <article key={report.id} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-800">
                    <FileText size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{report.cellName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {report.meetingDate} - Lider: {report.leaderName}
                        </p>
                      </div>
                      <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600">
                        {report.presentCount} presentes
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-slate-600">{report.highlights}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-base font-semibold">{report.visitorsCount}</p>
                        <p className="text-[11px] font-medium text-slate-400">visitantes</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-base font-semibold">{report.serviceCount}</p>
                        <p className="text-[11px] font-medium text-slate-400">culto</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-base font-semibold">{report.decisionsCount}</p>
                        <p className="text-[11px] font-medium text-slate-400">decisoes</p>
                      </div>
                    </div>
                    {(report.needs || report.prayerRequests) && (
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm leading-5 text-slate-500">
                        {report.needs && <p><strong className="text-slate-700">Acompanhar:</strong> {report.needs}</p>}
                        {report.prayerRequests && <p className="mt-1"><strong className="text-slate-700">Oracao:</strong> {report.prayerRequests}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {visibleReports.length === 0 && (
              <p className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-500">
                Nenhum relatorio enviado para as celulas visiveis neste perfil.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Cultos" title="Consolidacao enviada" />
          <div className="space-y-3">
            {consolidationReports.slice(0, 5).map((report) => (
              <article key={report.id} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-800">
                    <UserRoundPlus size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{report.serviceTitle}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {report.serviceDate} - Equipe: {report.createdByName}
                        </p>
                      </div>
                      <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600">
                        {report.visitorsCount} visitantes
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-base font-semibold">{report.totalAttendance}</p>
                        <p className="text-[11px] font-medium text-slate-400">total</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-base font-semibold">{report.templeCount ?? report.totalAttendance}</p>
                        <p className="text-[11px] font-medium text-slate-400">templo</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-base font-semibold">{report.kidsCount ?? 0}</p>
                        <p className="text-[11px] font-medium text-slate-400">kids</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-base font-semibold">{report.babyCount ?? 0}</p>
                        <p className="text-[11px] font-medium text-slate-400">baby</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-base font-semibold">{report.vagalumesCount ?? 0}</p>
                        <p className="text-[11px] font-medium text-slate-400">vagalumes</p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <p className="text-base font-semibold text-emerald-950">{report.servingCount}</p>
                        <p className="text-[11px] font-medium text-emerald-700">servindo</p>
                      </div>
                      <div className="rounded-lg bg-orange-50 p-2">
                        <p className="text-base font-semibold text-orange-950">{report.acceptedJesusCount + report.baptismDecisionCount}</p>
                        <p className="text-[11px] font-medium text-orange-700">decisoes</p>
                      </div>
                    </div>
                    {report.ministryCounts && Object.keys(report.ministryCounts).length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ["louvor", "Louvor"],
                          ["palavra", "Palavra"],
                          ["midia", "Midia"],
                          ["diaconato", "Diaconato"],
                          ["intercessao", "Intercessao"],
                          ["kids", "Kids"],
                          ["baby", "Baby"],
                          ["vagalumes", "Vagalumes"],
                          ["consolidacao", "Consolidacao"],
                        ].map(([key, label]) => (
                          <div key={key} className="rounded-lg bg-white p-2 text-center">
                            <p className="text-sm font-bold">{report.ministryCounts?.[key] ?? 0}</p>
                            <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {report.notes && <p className="mt-3 text-sm leading-5 text-slate-600">{report.notes}</p>}
                  </div>
                </div>
              </article>
            ))}
            {consolidationReports.length === 0 && (
              <p className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-500">
                Nenhuma consolidacao de culto enviada ainda.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Por celula" title="Relatorio para supervisao" />
          <div className="space-y-3">
            {visibleCells.map((cell) => {
              const stats = getCellStats(cell, visiblePeople);
              return (
                <article key={cell.id} className="rounded-lg bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{cell.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Lider: {cell.leaderName}</p>
                    </div>
                    <BarChart3 size={20} className="text-emerald-700" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    <div>
                      <p className="text-lg font-semibold">{stats.total}</p>
                      <p className="text-[11px] font-medium text-slate-400">pessoas</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{stats.present}</p>
                      <p className="text-[11px] font-medium text-slate-400">presentes</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{stats.servicePresent}</p>
                      <p className="text-[11px] font-medium text-slate-400">culto</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{stats.attention}</p>
                      <p className="text-[11px] font-medium text-slate-400">alertas</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
