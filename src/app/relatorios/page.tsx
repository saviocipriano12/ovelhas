"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Clipboard, Download, FileText, Plus, Sparkles, UserRoundPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { getScopedCells, getScopedPeople } from "@/lib/access-control";
import { useCellReports, useCells, useConsolidationReports, useLocalPeople } from "@/lib/local-store";
import { buildReportSummary, downloadReportHtml } from "@/lib/report-export";
import { getCellStats, getOverallStats } from "@/lib/reports";

const RECENT_REPORT_DAYS = 14;

function reportTime(value: string) {
  if (!value) {
    return 0;
  }

  if (value.includes("/")) {
    const [day, month, year] = value.split("/").map(Number);
    return new Date(year, month - 1, day).getTime();
  }

  return new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
}

function reportDateLabel(value: string) {
  if (!value) {
    return "Sem data";
  }

  if (value.includes("/")) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function daysSinceReport(value: string) {
  const time = reportTime(value);

  if (!time) {
    return Number.POSITIVE_INFINITY;
  }

  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.floor((current - time) / (24 * 60 * 60 * 1000));
}

export default function ReportsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { reports, reportLoadError } = useCellReports();
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
  const latestReportsByCell = visibleCells
    .map((cell) => {
      const latestReport =
        visibleReports
          .filter((report) => report.cellId === cell.id)
          .sort((left, right) => reportTime(right.meetingDate) - reportTime(left.meetingDate))[0] ?? null;

      return { cell, report: latestReport };
    })
    .sort((left, right) => (right.report ? reportTime(right.report.meetingDate) : 0) - (left.report ? reportTime(left.report.meetingDate) : 0));
  const cellsWithRecentReport = latestReportsByCell.filter(
    ({ report }) => report && daysSinceReport(report.meetingDate) <= RECENT_REPORT_DAYS,
  ).length;
  const cellsWithoutRecentReport = latestReportsByCell.filter(
    ({ report }) => !report || daysSinceReport(report.meetingDate) > RECENT_REPORT_DAYS,
  );
  const reportsNeedingAttention = latestReportsByCell.filter(
    ({ report }) => report && Boolean(report.needs || report.prayerRequests || report.supervisorVisitNotes),
  ).length;

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
          title="Painel de acompanhamento das celulas"
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

        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Visao da lideranca</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight">Quem enviou, quem esta pendente e onde a supervisao precisa agir</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                O relatorio da celula agora foca no encontro, no cuidado e nos proximos passos. Tudo que e culto fica concentrado na consolidacao.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-slate-100">
              {cellsWithoutRecentReport.length > 0
                ? `${cellsWithoutRecentReport.length} celula(s) sem envio recente`
                : "Todas as celulas visiveis possuem envio recente"}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <MetricCard icon={BarChart3} label="Celulas" value={String(overall.cells)} accent="bg-emerald-500" />
          <MetricCard icon={FileText} label="Envio recente" value={String(cellsWithRecentReport)} accent="bg-sky-500" />
          <MetricCard icon={AlertTriangle} label="Sem envio" value={String(cellsWithoutRecentReport.length)} accent="bg-amber-500" />
          <MetricCard icon={Sparkles} label="Pedir cuidado" value={String(reportsNeedingAttention)} accent="bg-orange-500" />
          <MetricCard icon={UserRoundPlus} label="Visitantes culto" value={String(consolidationTotals.visitors)} accent="bg-emerald-500" />
          <MetricCard icon={Sparkles} label="Decisoes culto" value={String(consolidationTotals.decisions)} accent="bg-violet-500" />
        </div>

        {reportLoadError && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Os relatorios exibidos podem estar incompletos neste aparelho. Nao foi possivel atualizar do servidor: {reportLoadError}
          </section>
        )}

        <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-950">Relatorio pronto para compartilhar</p>
              <p className="mt-1 text-sm leading-5 text-emerald-800">
                Gere um resumo claro para pastor, supervisor ou reuniao de lideranca.
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
          <SectionHeader eyebrow="Consolidado" title="Leitura geral da semana" />
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

        {cellsWithoutRecentReport.length > 0 && (
          <section className="rounded-lg border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <SectionHeader eyebrow="Pendencias" title="Celulas sem envio recente" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cellsWithoutRecentReport.map(({ cell, report }) => (
                <article key={cell.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="font-bold text-slate-950">{cell.name}</p>
                  <p className="mt-1 text-sm text-slate-500">Lider: {cell.leaderName}</p>
                  <p className="mt-3 text-sm font-semibold text-amber-900">
                    {report ? `Ultimo envio em ${reportDateLabel(report.meetingDate)}.` : "Ainda sem relatorio registrado."}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Leitura do supervisor" title="Ultimo relatorio por celula" />
          <div className="space-y-3">
            {latestReportsByCell.map(({ cell, report }) => {
              const stats = getCellStats(cell, visiblePeople);
              const reportAge = report ? daysSinceReport(report.meetingDate) : Number.POSITIVE_INFINITY;
              const statusTone =
                !report
                  ? "bg-slate-100 text-slate-500"
                  : reportAge <= RECENT_REPORT_DAYS
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900";
              const statusLabel =
                !report
                  ? "Sem relatorio"
                  : reportAge <= RECENT_REPORT_DAYS
                    ? `Enviado ha ${reportAge} dia(s)`
                    : `Ultimo envio ha ${reportAge} dia(s)`;

              return (
                <article key={cell.id} className="rounded-[24px] bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{cell.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Lider: {cell.leaderName}</p>
                      {report && (
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                          Reuniao em {reportDateLabel(report.meetingDate)}
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full px-3 py-2 text-xs font-black ${statusTone}`}>{statusLabel}</span>
                  </div>

                  {report ? (
                    <div className="space-y-3">
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-2xl font-black text-slate-950">{report.presentCount}</p>
                          <p className="text-[11px] font-bold uppercase text-slate-400">presentes</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-2xl font-black text-slate-950">{report.visitorsCount}</p>
                          <p className="text-[11px] font-bold uppercase text-slate-400">visitantes</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-2xl font-black text-slate-950">{report.decisionsCount}</p>
                          <p className="text-[11px] font-bold uppercase text-slate-400">decisoes</p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Destaques</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {report.highlights || "Sem destaques registrados neste envio."}
                        </p>
                      </div>

                      {(report.needs || report.prayerRequests || report.supervisorVisited || report.supervisorVisitNotes) && (
                        <div className="grid gap-3 md:grid-cols-2">
                          {report.needs && (
                            <div className="rounded-2xl bg-amber-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">Acompanhar</p>
                              <p className="mt-2 text-sm leading-6 text-amber-950">{report.needs}</p>
                            </div>
                          )}
                          {report.prayerRequests && (
                            <div className="rounded-2xl bg-sky-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-700">Oracao</p>
                              <p className="mt-2 text-sm leading-6 text-sky-950">{report.prayerRequests}</p>
                            </div>
                          )}
                          {(report.supervisorVisited || report.supervisorVisitNotes) && (
                            <div className="rounded-2xl bg-emerald-50 p-4 md:col-span-2">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                                {report.supervisorVisited ? "Supervisao presente" : "Observacao da supervisao"}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-emerald-950">
                                {report.supervisorVisitNotes || "A reuniao registrou presenca da supervisao sem observacao adicional."}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-lg font-black text-slate-950">{stats.total}</p>
                          <p className="text-[11px] font-bold uppercase text-slate-400">base atual</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-lg font-black text-slate-950">{stats.attention}</p>
                          <p className="text-[11px] font-bold uppercase text-slate-400">alertas</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-lg font-black text-slate-950">{stats.averageProgress}%</p>
                          <p className="text-[11px] font-bold uppercase text-slate-400">discipulado</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-lg font-black text-slate-950">{stats.present}</p>
                          <p className="text-[11px] font-bold uppercase text-slate-400">base presentes</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-500">
                      Esta celula ainda nao enviou relatorio para a supervisao.
                    </div>
                  )}
                </article>
              );
            })}
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
      </section>
    </AppShell>
  );
}
