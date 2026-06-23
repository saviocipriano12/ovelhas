"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Edit3, Filter, MapPin, MessageCircle, Route, Save, Search, UserRoundPlus, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { getScopedCells } from "@/lib/access-control";
import type { Cell, ConsolidationVisitor } from "@/lib/data";
import { useCells, useConsolidationReports, useLocalPeople } from "@/lib/local-store";
import { whatsappLink } from "@/lib/whatsapp";

type VisitorContact = ConsolidationVisitor & {
  reportId: string;
  serviceDate: string;
  serviceTitle: string;
  createdBy: string;
  createdByName: string;
};

const decisionLabels: Record<ConsolidationVisitor["decision"], string> = {
  visitante: "Visitante",
  aceitou_jesus: "Aceitou Jesus",
  batismo: "Decisao pelo batismo",
  reconciliacao: "Reconciliacao",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function suggestCell(cells: Cell[], neighborhood?: string, address?: string) {
  const target = `${normalize(neighborhood ?? "")} ${normalize(address ?? "")}`.trim();

  if (!target) {
    return cells[0];
  }

  return cells
    .map((cell) => {
      const cellText = `${normalize(cell.neighborhood)} ${normalize(cell.address)} ${normalize(cell.name)}`;
      const neighborhoodScore = neighborhood && cellText.includes(normalize(neighborhood)) ? 8 : 0;
      const wordScore = target
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .filter((word) => cellText.includes(word)).length;

      return { cell, score: neighborhoodScore + wordScore };
    })
    .sort((a, b) => b.score - a.score)[0]?.cell;
}

function stageFromDecision(decision: ConsolidationVisitor["decision"]) {
  if (decision === "aceitou_jesus") {
    return "Novo convertido";
  }

  if (decision === "batismo") {
    return "Batismo";
  }

  if (decision === "reconciliacao") {
    return "Reconciliacao";
  }

  return "Visitante";
}

function decisionTone(decision: ConsolidationVisitor["decision"]) {
  if (decision === "aceitou_jesus") {
    return "bg-emerald-100 text-emerald-900";
  }

  if (decision === "batismo") {
    return "bg-sky-100 text-sky-900";
  }

  if (decision === "reconciliacao") {
    return "bg-violet-100 text-violet-900";
  }

  return "bg-slate-100 text-slate-700";
}

export default function ConsolidationContactsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { addPerson, refreshPeople } = useLocalPeople();
  const { reports, updateVisitor, refreshReports, isLoadingReports, reportLoadError } = useConsolidationReports(currentUser.churchId);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | ConsolidationVisitor["decision"]>("pending");
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorContact | null>(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const contacts = useMemo<VisitorContact[]>(
    () =>
      reports.flatMap((report) =>
        report.visitors.map((visitor) => ({
          ...visitor,
          reportId: report.id,
          serviceDate: report.serviceDate,
          serviceTitle: report.serviceTitle,
          createdBy: report.createdBy,
          createdByName: report.createdByName,
        })),
      ),
    [reports],
  );

  const pendingContacts = contacts.filter((visitor) => !visitor.personId);
  const decisionContacts = contacts.filter((visitor) => visitor.decision !== "visitante");

  const filteredContacts = useMemo(() => {
    const normalizedQuery = normalize(query);

    return contacts.filter((visitor) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && !visitor.personId) ||
        visitor.decision === filter;
      const matchesQuery =
        !normalizedQuery ||
        normalize([visitor.name, visitor.phone, visitor.neighborhood, visitor.address, visitor.serviceTitle].join(" ")).includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [contacts, filter, query]);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVisitor) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const age = Number(formData.get("age") || 0);
    const address = String(formData.get("address") || "").trim();
    const neighborhood = String(formData.get("neighborhood") || "").trim();
    const decision = String(formData.get("decision") || selectedVisitor.decision) as ConsolidationVisitor["decision"];
    const notes = String(formData.get("notes") || "").trim();
    const cellId = String(formData.get("cellId") || selectedVisitor.suggestedCellId || "");
    const selectedCell = visibleCells.find((cell) => cell.id === cellId) ?? suggestCell(visibleCells, neighborhood, address);

    if (!name || !phone) {
      setFeedback("Informe nome e WhatsApp antes de salvar.");
      return;
    }

    setSaving(true);
    let personId = selectedVisitor.personId;

    if (!personId && selectedCell) {
      const personResult = await addPerson({
        name,
        phone,
        email,
        address,
        neighborhood,
        stage: stageFromDecision(decision),
        createdByUserId: currentUser.id,
        leaderUserId: selectedCell.leaderUserId || currentUser.id,
        churchId: currentUser.churchId,
        cellId: selectedCell.id,
        cellName: selectedCell.name,
        persistToSupabase: !isDemoMode,
      });

      if (!personResult.ok || !personResult.person) {
        setSaving(false);
        setFeedback(`Nao consegui encaminhar para Pessoas: ${personResult.error}`);
        return;
      }

      personId = personResult.person.id;
    }

    const updateResult = await updateVisitor(selectedVisitor.id, {
      name,
      phone,
      email,
      age: age > 0 ? age : undefined,
      address,
      neighborhood,
      decision,
      notes,
      suggestedCellId: selectedCell?.id,
      suggestedCellName: selectedCell?.name,
      personId,
      persistToSupabase: !isDemoMode,
    });

    setSaving(false);

    if (!updateResult.ok) {
      setFeedback(`Nao consegui salvar contato: ${updateResult.error}`);
      return;
    }

    await Promise.all([refreshReports(), refreshPeople()]);
    setSelectedVisitor(null);
    setFeedback(selectedCell ? `${name} foi direcionado para ${selectedCell.name}.` : `${name} foi atualizado.`);
  }

  return (
    <AppShell hideMobileNav={Boolean(selectedVisitor)} hidePwaStatus={Boolean(selectedVisitor)}>
      <section className="animate-enter space-y-4">
        {!selectedVisitor && (
          <>
        <SectionHeader
          eyebrow="Consolidacao"
          title="Contatos e encaminhamentos"
          action={
            <button
              onClick={() => refreshReports()}
              className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-900"
            >
              {isLoadingReports ? "Atualizando..." : "Atualizar"}
            </button>
          }
        />

        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10">
          <p className="text-xs font-black uppercase text-emerald-200">Carteira de retorno</p>
          <h1 className="mt-1 text-2xl font-black leading-tight">Visitantes, decisoes e proximos passos</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            A consolidacao acompanha quem foi cadastrado no culto, corrige dados e direciona para uma celula e lider responsavel.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{contacts.length}</p>
              <p className="text-[11px] font-bold text-slate-300">contatos</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{pendingContacts.length}</p>
              <p className="text-[11px] font-bold text-slate-300">pendentes</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{decisionContacts.length}</p>
              <p className="text-[11px] font-bold text-slate-300">decisoes</p>
            </div>
          </div>
        </section>

        {feedback && (
          <p className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
            {feedback}
          </p>
        )}

        {reportLoadError && (
          <p className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">
            Nao consegui carregar contatos: {reportLoadError}
          </p>
        )}

        <div className="rounded-[24px] border border-white/80 bg-white/90 p-3 shadow-sm">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-100 px-3 text-sm text-slate-500">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Buscar por nome, bairro, telefone ou culto"
            />
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
          {[
            { id: "pending", label: "Pendentes" },
            { id: "all", label: "Todos" },
            { id: "visitante", label: "Visitantes" },
            { id: "aceitou_jesus", label: "Aceitaram Jesus" },
            { id: "batismo", label: "Batismo" },
            { id: "reconciliacao", label: "Reconciliacao" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as typeof filter)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black ${
                filter === item.id ? "bg-emerald-900 text-white" : "border border-white/80 bg-white/90 text-slate-600"
              }`}
            >
              <Filter size={14} />
              {item.label}
            </button>
          ))}
        </div>

        <section className="grid gap-3 xl:grid-cols-2">
          {filteredContacts.map((visitor) => {
            const suggested = visitor.suggestedCellId
              ? visibleCells.find((cell) => cell.id === visitor.suggestedCellId)
              : suggestCell(visibleCells, visitor.neighborhood, visitor.address);

            return (
              <article key={visitor.id} className="rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black ${decisionTone(visitor.decision)}`}>
                        {decisionLabels[visitor.decision]}
                      </span>
                      {visitor.personId ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800">
                          Encaminhado
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-900">
                          Pendente
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 truncate text-xl font-black text-slate-950">{visitor.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {visitor.serviceTitle} - {visitor.serviceDate}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedVisitor({ ...visitor, suggestedCellId: suggested?.id ?? visitor.suggestedCellId, suggestedCellName: suggested?.name ?? visitor.suggestedCellName })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"
                    aria-label={`Editar ${visitor.name}`}
                  >
                    <Edit3 size={17} />
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-black uppercase text-slate-400">Telefone</p>
                    <p className="mt-1 truncate text-sm font-black text-slate-900">{visitor.phone || "Sem telefone"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-black uppercase text-slate-400">Localidade</p>
                    <p className="mt-1 truncate text-sm font-black text-slate-900">{visitor.neighborhood || visitor.address || "Nao informado"}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
                  <MapPin className="mr-2 inline" size={15} />
                  Sugestao: {suggested?.name ?? visitor.suggestedCellName ?? "cadastre celulas com bairro"}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={whatsappLink(visitor.phone, `Ola, ${visitor.name}! Aqui e da equipe de consolidacao. Foi uma alegria receber voce no culto. Podemos te ajudar nos proximos passos?`)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-3 text-xs font-black text-white"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                  <button
                    onClick={() => setSelectedVisitor({ ...visitor, suggestedCellId: suggested?.id ?? visitor.suggestedCellId, suggestedCellName: suggested?.name ?? visitor.suggestedCellName })}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-3 text-xs font-black text-white"
                  >
                    <Route size={16} />
                    Direcionar
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {filteredContacts.length === 0 && (
          <section className="rounded-[28px] border border-dashed border-slate-200 bg-white/80 p-8 text-center">
            <UserRoundPlus className="mx-auto text-slate-300" size={34} />
            <p className="mt-3 text-sm font-bold text-slate-500">
              Nenhum contato encontrado neste filtro.
            </p>
          </section>
        )}

          </>
        )}

        {selectedVisitor && (
          <form onSubmit={saveContact} className="form-screen animate-enter mx-auto w-full max-w-6xl">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-1 py-3 backdrop-blur sm:px-0">
                <div>
                  <p className="text-xs font-black uppercase text-emerald-700">Encaminhamento</p>
                  <h2 className="text-xl font-black text-slate-950">Editar contato</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVisitor(null)}
                  className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700"
                  aria-label="Cancelar"
                >
                  <X size={18} />
                  <span className="hidden sm:inline">Cancelar</span>
                </button>
              </div>

              <div className="form-screen-body min-h-0 flex-1 py-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <p className="mb-1 text-xs font-black uppercase text-emerald-700">Contato</p>
                    <h3 className="mb-4 text-lg font-black text-slate-950">Quem vamos acompanhar?</h3>
                    <div className="space-y-3">
                      <input name="name" defaultValue={selectedVisitor.name} required className="field-control" placeholder="Nome completo" />
                      <input name="phone" defaultValue={selectedVisitor.phone} required inputMode="tel" className="field-control" placeholder="WhatsApp com DDD" />
                      <select name="decision" defaultValue={selectedVisitor.decision} className="field-control">
                        <option value="visitante">Visitante</option><option value="aceitou_jesus">Aceitou Jesus</option><option value="batismo">Decisao pelo batismo</option><option value="reconciliacao">Reconciliacao</option>
                      </select>
                    </div>
                  </section>

                  <section className="rounded-[24px] bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <p className="mb-1 text-xs font-black uppercase text-emerald-700">Encaminhamento</p>
                    <h3 className="mb-4 text-lg font-black text-slate-950">Para onde essa pessoa vai?</h3>
                    <select name="cellId" defaultValue={selectedVisitor.suggestedCellId} className="field-control">
                      <option value="">Escolher celula</option>
                      {visibleCells.map((cell) => (
                        <option key={cell.id} value={cell.id}>{cell.name} {cell.neighborhood ? `- ${cell.neighborhood}` : ""}</option>
                      ))}
                    </select>
                    <div className="mt-4 rounded-2xl bg-white/80 p-3 text-sm font-bold text-emerald-950">
                      <CheckCircle2 className="mr-2 inline" size={15} />
                      Ao salvar, o Ovelhas cria ou atualiza o cadastro e direciona para o lider da celula.
                    </div>
                  </section>

                  <details className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
                    <summary className="cursor-pointer list-none text-sm font-black text-slate-800 marker:hidden">
                      Complementar cadastro <span className="ml-1 text-xs font-semibold text-slate-400">opcional</span>
                    </summary>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input name="email" defaultValue={selectedVisitor.email} type="email" className="field-control" placeholder="Email opcional" />
                      <input name="age" defaultValue={selectedVisitor.age} type="number" min="0" className="field-control" placeholder="Idade" />
                      <input name="neighborhood" defaultValue={selectedVisitor.neighborhood} className="field-control" placeholder="Bairro" />
                      <input name="address" defaultValue={selectedVisitor.address} className="field-control" placeholder="Endereco completo" />
                      <textarea name="notes" defaultValue={selectedVisitor.notes} rows={3} className="field-control min-h-28 resize-none py-3 sm:col-span-2" placeholder="Observacoes para o retorno" />
                    </div>
                  </details>
                </div>
              </div>

              <div className="form-screen-footer shrink-0 border-t border-slate-200/80 bg-white/95 py-3 backdrop-blur">
                <button disabled={saving} className="primary-action min-h-14 disabled:opacity-60">
                  <Save size={17} />
                  {saving ? "Salvando..." : "Salvar e direcionar"}
                </button>
              </div>
          </form>
        )}
      </section>
    </AppShell>
  );
}
