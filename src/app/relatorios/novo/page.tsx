"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CalendarDays, ClipboardCheck, Eye, Sparkles, UserRoundPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { getScopedCells, getScopedPeople } from "@/lib/access-control";
import { useCellReports, useCells, useLocalPeople } from "@/lib/local-store";
import { getCellStats } from "@/lib/reports";

function parseReportDate(value: string) {
  if (!value) {
    return 0;
  }

  if (value.includes("/")) {
    const [day, month, year] = value.split("/").map(Number);
    return new Date(year, month - 1, day).getTime();
  }

  return new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
}

function formatReportDate(value: string) {
  if (!value) {
    return "Sem data";
  }

  if (value.includes("/")) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export default function NewReportPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { reports, addReport } = useCellReports();
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const writableCells = visibleCells.filter((cell) => currentUser.role !== "supervisor" || cell.supervisorUserId === currentUser.id);
  const [selectedCellId, setSelectedCellId] = useState(writableCells[0]?.id ?? visibleCells[0]?.id ?? "");
  const [saveFeedback, setSaveFeedback] = useState<{ tone: "success" | "warning"; message: string } | null>(null);

  const selectedCell = cells.find((cell) => cell.id === selectedCellId) ?? writableCells[0] ?? visibleCells[0];
  const stats = selectedCell ? getCellStats(selectedCell, visiblePeople) : null;
  const latestCellReport = selectedCell
    ? reports
        .filter((report) => report.cellId === selectedCell.id)
        .sort((left, right) => parseReportDate(right.meetingDate) - parseReportDate(left.meetingDate))[0] ?? null
    : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCell) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const result = await addReport({
      churchId: selectedCell.churchId,
      cellId: selectedCell.id,
      cellName: selectedCell.name,
      leaderUserId: selectedCell.leaderUserId,
      leaderName: selectedCell.leaderName,
      supervisorUserId: selectedCell.supervisorUserId,
      meetingDate: String(formData.get("meetingDate") || new Date().toISOString().slice(0, 10)),
      presentCount: Number(formData.get("presentCount") || stats?.present || 0),
      visitorsCount: Number(formData.get("visitorsCount") || 0),
      serviceCount: 0,
      decisionsCount: Number(formData.get("decisionsCount") || 0),
      highlights: String(formData.get("highlights") || "").trim(),
      needs: String(formData.get("needs") || "").trim(),
      prayerRequests: String(formData.get("prayerRequests") || "").trim(),
      supervisorVisited: formData.get("supervisorVisited") === "on",
      supervisorVisitNotes: String(formData.get("supervisorVisitNotes") || "").trim(),
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setSaveFeedback({
        tone: "warning",
        message: `Relatorio de ${result.report.cellName} salvo apenas neste dispositivo. A sincronizacao falhou: ${result.error}`,
      });
      event.currentTarget.reset();
      return;
    }

    setSaveFeedback({
      tone: "success",
      message: isDemoMode
        ? `Relatorio de ${result.report.cellName} salvo neste dispositivo em modo demonstracao.`
        : `Relatorio de ${result.report.cellName} salvo para supervisao.`,
    });
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
          <SectionHeader eyebrow="Relatorio" title="Fechamento da reuniao da celula" />
        </div>

        {saveFeedback && (
          <div
            className={`rounded-[22px] p-4 text-sm font-semibold ${
              saveFeedback.tone === "success"
                ? "border border-emerald-100 bg-emerald-50 text-emerald-900"
                : "border border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {saveFeedback.message}
          </div>
        )}

        {!selectedCell ? (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900 shadow-sm">
            Nenhuma celula disponivel para este perfil preencher relatorio agora.
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <aside className="space-y-4">
              <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Envio guiado</p>
                <h2 className="mt-2 text-2xl font-bold leading-tight">{selectedCell.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Preencha como se voce estivesse atualizando seu supervisor em 1 minuto: o que aconteceu, quem precisa de cuidado e o que merece oracao.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-[11px] font-black uppercase text-slate-400">Lider</p>
                    <p className="mt-1 font-bold">{selectedCell.leaderName}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-[11px] font-black uppercase text-slate-400">Supervisor</p>
                    <p className="mt-1 font-bold">{selectedCell.supervisorUserId ? "Vinculado" : "Nao vinculado"}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm">
                <SectionHeader eyebrow="Base atual" title="Panorama da celula" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-[11px] font-black uppercase text-emerald-700">Pessoas</p>
                    <p className="mt-2 text-3xl font-black text-emerald-950">{stats?.total ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-4">
                    <p className="text-[11px] font-black uppercase text-sky-700">Presentes base</p>
                    <p className="mt-2 text-3xl font-black text-sky-950">{stats?.present ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <p className="text-[11px] font-black uppercase text-amber-700">Alertas</p>
                    <p className="mt-2 text-3xl font-black text-amber-950">{stats?.attention ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-violet-50 p-4">
                    <p className="text-[11px] font-black uppercase text-violet-700">Discipulado</p>
                    <p className="mt-2 text-3xl font-black text-violet-950">{stats?.averageProgress ?? 0}%</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm">
                <SectionHeader eyebrow="Leitura do supervisor" title="O que nao pode faltar" />
                <div className="space-y-3 text-sm leading-6 text-slate-600">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-black text-slate-900">1. Resumo da reuniao</p>
                    <p className="mt-1">Conte o principal movimento da noite: clima da reuniao, resposta das pessoas e qualquer marco importante.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-black text-slate-900">2. Quem precisa de acompanhamento</p>
                    <p className="mt-1">Nomeie o que precisa de acao pastoral: ausencia, crise, visita, conversa, discipulado ou encaminhamento.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-black text-slate-900">3. Pedido de oracao ou apoio</p>
                    <p className="mt-1">Se a lideranca precisar orar, cobrir ou intervir, deixe isso explicito no campo final.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm">
                <SectionHeader eyebrow="Ultimo envio" title="Referencia rapida" />
                {latestCellReport ? (
                  <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase text-emerald-700">{formatReportDate(latestCellReport.meetingDate)}</p>
                        <p className="mt-1 font-bold text-slate-950">{latestCellReport.presentCount} presentes</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600">
                        {latestCellReport.visitorsCount} visitantes
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">
                      {latestCellReport.highlights || "Sem destaques registrados no ultimo envio."}
                    </p>
                    {(latestCellReport.needs || latestCellReport.prayerRequests) && (
                      <div className="rounded-2xl bg-white p-3 text-sm leading-6 text-slate-600">
                        {latestCellReport.needs && <p><strong className="text-slate-900">Acompanhar:</strong> {latestCellReport.needs}</p>}
                        {latestCellReport.prayerRequests && <p><strong className="text-slate-900">Oracao:</strong> {latestCellReport.prayerRequests}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Esta celula ainda nao tem relatorio anterior registrado.
                  </div>
                )}
              </section>
            </aside>

            <form
              key={selectedCell.id}
              onSubmit={handleSubmit}
              className="space-y-4 rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm"
            >
              <SectionHeader eyebrow="Preenchimento" title="Enviar relatorio da semana" />

              <section className="rounded-[24px] bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-emerald-900">
                  <CalendarDays size={18} />
                  <p className="text-sm font-black">Resumo objetivo da reuniao</p>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold uppercase text-slate-400">Celula</span>
                    <select
                      value={selectedCellId}
                      onChange={(event) => setSelectedCellId(event.target.value)}
                      className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
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
                      className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-slate-400">Presentes</span>
                      <input
                        name="presentCount"
                        type="number"
                        min="0"
                        defaultValue={stats?.present ?? 0}
                        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-slate-400">Visitantes</span>
                      <input
                        name="visitorsCount"
                        type="number"
                        min="0"
                        defaultValue="0"
                        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-slate-400">Decisoes</span>
                      <input
                        name="decisionsCount"
                        type="number"
                        min="0"
                        defaultValue="0"
                        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <Sparkles size={18} />
                  <p className="text-sm font-black">Leitura pastoral da reuniao</p>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold uppercase text-slate-400">Destaques da reuniao</span>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Explique o que aconteceu de mais importante, quem respondeu bem e qual foi o tom da noite.</p>
                    <textarea
                      name="highlights"
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500"
                      placeholder="Ex: tivemos boa participacao, um visitante voltou pela segunda vez e a conversa final abriu espaco para discipulado."
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase text-slate-400">Necessidades de acompanhamento</span>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Deixe claro o que pede acao: visita, contato, aconselhamento, ajuste com a equipe ou cuidado com alguem especifico.</p>
                    <textarea
                      name="needs"
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500"
                      placeholder="Ex: Ana faltou de novo e precisa de visita; Joao pediu conversa com o lider; visitante novo precisa de retorno ate sexta."
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase text-slate-400">Pedidos de oracao</span>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Use este campo para tudo que precisa de cobertura espiritual da supervisao, pastor ou equipe.</p>
                    <textarea
                      name="prayerRequests"
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500"
                      placeholder="Ex: orar pela familia de Carlos, pela saude de Maria e pela consolidacao dos dois visitantes."
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-[24px] bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-950">
                  <Eye size={18} />
                  <p className="text-sm font-black">Cobertura da supervisao</p>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700">
                    <input name="supervisorVisited" type="checkbox" className="mt-1 h-5 w-5 accent-emerald-700" />
                    <span>
                      Supervisor participou desta reuniao
                      <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
                        Marque isso quando o supervisor esteve presente ou acompanhou este encontro de perto.
                      </span>
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase text-emerald-700">Observacao da supervisao</span>
                    <textarea
                      name="supervisorVisitNotes"
                      rows={3}
                      className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500"
                      placeholder="Ex: o supervisor reforcou o proximo passo com a lideranca, orientou retorno aos visitantes e sinalizou acompanhamento de um caso sensivel."
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                    <Users size={16} className="mx-auto text-emerald-700" />
                    <p className="mt-2 text-2xl font-black text-emerald-950">{stats?.total ?? 0}</p>
                    <p className="text-[11px] font-bold uppercase text-emerald-700">base</p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-3 text-center">
                    <ClipboardCheck size={16} className="mx-auto text-sky-700" />
                    <p className="mt-2 text-2xl font-black text-sky-950">{stats?.present ?? 0}</p>
                    <p className="text-[11px] font-bold uppercase text-sky-700">referencia</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3 text-center">
                    <UserRoundPlus size={16} className="mx-auto text-amber-700" />
                    <p className="mt-2 text-2xl font-black text-amber-950">{latestCellReport?.visitorsCount ?? 0}</p>
                    <p className="text-[11px] font-bold uppercase text-amber-700">ultimo envio</p>
                  </div>
                </div>

                <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/15">
                  <ClipboardCheck size={18} />
                  Salvar relatorio da celula
                </button>
              </section>
            </form>
          </div>
        )}
      </section>
    </AppShell>
  );
}
