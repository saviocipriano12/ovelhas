"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ClipboardCheck,
  MapPin,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { SectionHeader } from "@/components/section-header";
import { getScopedCells } from "@/lib/access-control";
import type { Cell, ConsolidationVisitor } from "@/lib/data";
import { useActivityEvents, useCells, useConsolidationReports, useLocalPeople } from "@/lib/local-store";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function suggestCell(cells: Cell[], neighborhood: string, address: string) {
  const target = `${normalize(neighborhood)} ${normalize(address)}`;

  if (!target.trim()) {
    return cells[0];
  }

  const scored = cells
    .map((cell) => {
      const cellText = `${normalize(cell.neighborhood)} ${normalize(cell.address)} ${normalize(cell.name)}`;
      const neighborhoodScore = normalize(neighborhood) && cellText.includes(normalize(neighborhood)) ? 8 : 0;
      const words = target.split(/\s+/).filter((word) => word.length > 3);
      const wordScore = words.filter((word) => cellText.includes(word)).length;
      return { cell, score: neighborhoodScore + wordScore };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.cell ?? cells[0];
}

const decisionLabels: Record<ConsolidationVisitor["decision"], string> = {
  visitante: "Visitante",
  aceitou_jesus: "Aceitou Jesus",
  batismo: "Decisao pelo batismo",
  reconciliacao: "Reconciliacao",
};

export default function ConsolidationPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { addPerson, refreshPeople } = useLocalPeople();
  const { reports, addReport, deleteReport, refreshReports, isLoadingReports, reportLoadError } = useConsolidationReports(currentUser.churchId);
  const { addEvent } = useActivityEvents();
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [serviceTitle, setServiceTitle] = useState("Culto principal");
  const [totalAttendance, setTotalAttendance] = useState(0);
  const [servingCount, setServingCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [visitors, setVisitors] = useState<ConsolidationVisitor[]>([]);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const acceptedJesusCount = visitors.filter((visitor) => visitor.decision === "aceitou_jesus").length;
  const baptismDecisionCount = visitors.filter((visitor) => visitor.decision === "batismo").length;
  const latestReports = reports.slice(0, 4);
  const monthTotals = useMemo(
    () =>
      reports.reduce(
        (totals, report) => ({
          attendance: totals.attendance + report.totalAttendance,
          visitors: totals.visitors + report.visitorsCount,
          decisions: totals.decisions + report.acceptedJesusCount + report.baptismDecisionCount,
        }),
        { attendance: 0, visitors: 0, decisions: 0 },
      ),
    [reports],
  );

  function addVisitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const neighborhood = String(formData.get("neighborhood") || "").trim();
    const decision = String(formData.get("decision") || "visitante") as ConsolidationVisitor["decision"];
    const visitorNotes = String(formData.get("notes") || "").trim();
    const suggestedCell = suggestCell(visibleCells, neighborhood, address);

    if (!name || !phone) {
      setFeedback("Informe nome e WhatsApp do visitante.");
      return;
    }

    setVisitors((current) => [
      {
        id: `visitante-${Date.now()}`,
        name,
        phone,
        email,
        address,
        neighborhood,
        decision,
        notes: visitorNotes,
        suggestedCellId: suggestedCell?.id,
        suggestedCellName: suggestedCell?.name,
      },
      ...current,
    ]);
    setFeedback(suggestedCell ? `${name} foi sugerido para a celula ${suggestedCell.name}.` : `${name} foi adicionado.`);
    event.currentTarget.reset();
  }

  async function saveConsolidation() {
    if (saving) {
      return;
    }

    setSaving(true);
    setFeedback("");

    const visitorsWithPeople: ConsolidationVisitor[] = [];

    for (const visitor of visitors) {
      const selectedCell = visibleCells.find((cell) => cell.id === visitor.suggestedCellId);
      const personResult = await addPerson({
        name: visitor.name,
        phone: visitor.phone,
        email: visitor.email,
        neighborhood: visitor.neighborhood || "",
        stage: visitor.decision === "aceitou_jesus" ? "Novo convertido" : visitor.decision === "batismo" ? "Batismo" : "Visitante",
        createdByUserId: currentUser.id,
        leaderUserId: selectedCell?.leaderUserId || currentUser.id,
        churchId: currentUser.churchId,
        cellId: selectedCell?.id,
        cellName: selectedCell?.name,
        persistToSupabase: !isDemoMode,
      });

      if (!personResult.ok) {
        setSaving(false);
        setFeedback(`Nao consegui cadastrar ${visitor.name}: ${personResult.error}`);
        return;
      }

      visitorsWithPeople.push({ ...visitor, personId: personResult.person?.id });
    }

    const reportResult = await addReport({
      churchId: currentUser.churchId,
      serviceDate,
      serviceTitle,
      totalAttendance,
      servingCount,
      visitorsCount: visitorsWithPeople.length,
      acceptedJesusCount,
      baptismDecisionCount,
      notes,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      visitors: visitorsWithPeople,
      persistToSupabase: !isDemoMode,
    });

    if (!reportResult.ok) {
      setSaving(false);
      setFeedback(`Nao consegui salvar a consolidacao: ${reportResult.error}`);
      return;
    }

    await addEvent({
      churchId: currentUser.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Registrou consolidacao",
      description: `${serviceTitle}: ${totalAttendance} pessoas, ${visitorsWithPeople.length} visitantes, ${acceptedJesusCount} decisoes por Jesus e ${baptismDecisionCount} decisoes por batismo.`,
      targetType: "person",
      targetName: "Consolidacao do culto",
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    await Promise.all([refreshPeople(), refreshReports()]);
    setVisitors([]);
    setSaving(false);
    setFeedback("Consolidacao salva. Visitantes foram cadastrados e encaminhados para cuidado.");
  }

  async function handleDeleteReport(reportId: string, title: string) {
    if (!window.confirm(`Apagar a consolidacao de ${title}?`)) {
      return;
    }

    const result = await deleteReport(reportId, !isDemoMode);
    setFeedback(result.ok ? "Consolidacao apagada." : `Nao consegui apagar: ${result.error}`);
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5 pb-6">
        <SectionHeader
          eyebrow="Ministerio"
          title="Consolidacao"
          action={
            <button
              onClick={async () => {
                const result = await refreshReports();
                setFeedback(result.ok ? "Consolidacao atualizada." : `Nao consegui atualizar: ${result.error}`);
              }}
              className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900"
            >
              {isLoadingReports ? "Atualizando..." : "Atualizar"}
            </button>
          }
        />

        <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10">
          <p className="text-xs font-black uppercase text-emerald-200">Porta de entrada</p>
          <h2 className="mt-1 text-2xl font-black leading-tight">Culto, visitantes e decisoes em um fluxo so</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Registre o culto, cadastre visitantes e veja a sugestao de celula mais proxima pelo bairro ou endereco.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{visitors.length}</p>
              <p className="text-[11px] font-bold text-slate-300">visitantes</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{acceptedJesusCount}</p>
              <p className="text-[11px] font-bold text-slate-300">Jesus</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{baptismDecisionCount}</p>
              <p className="text-[11px] font-bold text-slate-300">batismo</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MetricCard icon={UsersRound} label="Publico" value={String(monthTotals.attendance)} accent="bg-sky-500" />
          <MetricCard icon={UserRoundPlus} label="Visitantes" value={String(monthTotals.visitors)} accent="bg-emerald-500" />
          <MetricCard icon={Sparkles} label="Decisoes" value={String(monthTotals.decisions)} accent="bg-amber-500" />
        </div>

        {feedback && (
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
            {feedback}
          </div>
        )}

        {reportLoadError && (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">
            Nao consegui carregar consolidacao: {reportLoadError}
          </div>
        )}

        <section className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-sm">
          <SectionHeader eyebrow="Culto" title="Dados gerais" />
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-xs font-black uppercase text-slate-400">Data</span>
              <input
                type="date"
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </label>
            <label>
              <span className="text-xs font-black uppercase text-slate-400">Culto</span>
              <input
                value={serviceTitle}
                onChange={(event) => setServiceTitle(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </label>
            <label>
              <span className="text-xs font-black uppercase text-slate-400">Total no culto</span>
              <input
                type="number"
                min="0"
                value={totalAttendance}
                onChange={(event) => setTotalAttendance(Number(event.target.value))}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </label>
            <label>
              <span className="text-xs font-black uppercase text-slate-400">Servindo</span>
              <input
                type="number"
                min="0"
                value={servingCount}
                onChange={(event) => setServingCount(Number(event.target.value))}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </label>
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="mt-3 w-full resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
            placeholder="Observacoes do culto, fluxo de recepcao, pontos de atencao..."
          />
        </section>

        <form onSubmit={addVisitor} className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-sm">
          <SectionHeader eyebrow="Novo contato" title="Cadastrar visitante ou decisao" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder="Nome completo" className="min-h-12 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 sm:col-span-2" />
            <input name="phone" required inputMode="tel" placeholder="WhatsApp com DDD" className="min-h-12 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
            <input name="email" type="email" placeholder="Email opcional" className="min-h-12 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
            <input name="neighborhood" placeholder="Bairro" className="min-h-12 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
            <input name="address" placeholder="Endereco" className="min-h-12 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
            <select name="decision" className="min-h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 sm:col-span-2">
              <option value="visitante">Visitante</option>
              <option value="aceitou_jesus">Aceitou Jesus</option>
              <option value="batismo">Decisao pelo batismo</option>
              <option value="reconciliacao">Reconciliacao</option>
            </select>
            <textarea name="notes" rows={2} placeholder="Observacao rapida" className="resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 sm:col-span-2" />
          </div>
          <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 text-sm font-black text-white">
            <Plus size={18} />
            Adicionar contato
          </button>
        </form>

        <section className="space-y-3">
          <SectionHeader eyebrow="Encaminhamento" title="Contatos deste culto" />
          {visitors.map((visitor) => (
            <article key={visitor.id} className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-slate-950">{visitor.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{decisionLabels[visitor.decision]}</p>
                </div>
                <button
                  onClick={() => setVisitors((current) => current.filter((item) => item.id !== visitor.id))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"
                  aria-label={`Remover ${visitor.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
                <MapPin className="mr-2 inline" size={15} />
                Sugestao: {visitor.suggestedCellName ?? "cadastre celulas com bairro para sugerir melhor"}
              </div>
            </article>
          ))}
          {visitors.length === 0 && (
            <p className="rounded-3xl bg-white/90 p-5 text-center text-sm font-semibold text-slate-500">
              Nenhum visitante adicionado neste culto ainda.
            </p>
          )}
        </section>

        <button
          onClick={saveConsolidation}
          disabled={saving}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-slate-950 px-4 text-sm font-black text-white shadow-xl shadow-slate-950/15 disabled:opacity-60"
        >
          {saving ? <ClipboardCheck size={18} /> : <Save size={18} />}
          {saving ? "Salvando consolidacao..." : "Salvar consolidacao do culto"}
        </button>

        <section className="space-y-3">
          <SectionHeader eyebrow="Historico" title="Ultimos cultos" />
          {latestReports.map((report) => (
            <article key={report.id} className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{report.serviceTitle}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{report.serviceDate} · {report.createdByName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900">
                    {report.visitorsCount} visitantes
                  </span>
                  <button
                    onClick={() => handleDeleteReport(report.id, report.serviceTitle)}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"
                    aria-label={`Apagar ${report.serviceTitle}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-lg font-black">{report.totalAttendance}</p>
                  <p className="text-[11px] font-bold text-slate-500">culto</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-lg font-black">{report.servingCount}</p>
                  <p className="text-[11px] font-bold text-slate-500">servindo</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-lg font-black">{report.acceptedJesusCount + report.baptismDecisionCount}</p>
                  <p className="text-[11px] font-bold text-slate-500">decisoes</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </section>
    </AppShell>
  );
}
