"use client";

import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Home,
  Link2,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { getScopedCells, getScopedPeaceHouses, getScopedPeacePairs } from "@/lib/access-control";
import { roleLabels, type PeaceHouse, type PeaceVisit } from "@/lib/data";
import { useCells, usePeaceHouses, usePeacePairs, useProfiles } from "@/lib/local-store";

const STATUS_LABELS: Record<PeaceHouse["status"], string> = {
  em_acompanhamento: "Em acompanhamento",
  pronta_para_celula: "Pronta para virar celula",
  virou_celula: "Virou celula",
};

const STATUS_TONES: Record<PeaceHouse["status"], string> = {
  em_acompanhamento: "bg-slate-100 text-slate-600",
  pronta_para_celula: "bg-amber-100 text-amber-900",
  virou_celula: "bg-emerald-100 text-emerald-800",
};

const fieldClass = "min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500";
const selectClass = "min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700";

export default function PeaceHousesPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { profiles } = useProfiles();
  const {
    houses,
    addPeaceHouse,
    updatePeaceHouseLink,
    updatePeaceHouseDetails,
    deletePeaceHouse,
    addVisit,
    loadVisits,
    promoteToCell,
  } = usePeaceHouses();
  const { pairs, addPeacePair, updatePeacePairLink, updatePeacePairDetails, deletePeacePair } = usePeacePairs();
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleHouses = getScopedPeaceHouses(currentUser, houses, cells, isDemoMode);
  const visiblePairs = getScopedPeacePairs(currentUser, pairs, cells, isDemoMode);
  const toast = useToast();
  const confirm = useConfirm();
  const canManageChurchWide = currentUser.role === "admin" || currentUser.role === "pastor";

  const [tab, setTab] = useState<"casas" | "duplas">("casas");
  const [houseFormOpen, setHouseFormOpen] = useState(false);
  const [pairFormOpen, setPairFormOpen] = useState(false);
  const [editingHouseId, setEditingHouseId] = useState<string | null>(null);
  const [editingPairId, setEditingPairId] = useState<string | null>(null);
  const [visitHouseId, setVisitHouseId] = useState<string | null>(null);
  const [promoteHouseId, setPromoteHouseId] = useState<string | null>(null);
  const [matchingHouseId, setMatchingHouseId] = useState<string | null>(null);
  const [matchingPairId, setMatchingPairId] = useState<string | null>(null);
  const [visitHistory, setVisitHistory] = useState<Record<string, PeaceVisit[]>>({});
  const [pairFormCellId, setPairFormCellId] = useState(visibleCells[0]?.id ?? "");

  const sortedHouses = [...visibleHouses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sortedPairs = [...visiblePairs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unmatchedHouses = visibleHouses.filter((house) => !house.hasPair);
  const unmatchedPairs = visiblePairs.filter((pair) => !pair.hasHouse);
  const funnel = {
    total: visibleHouses.length,
    readyOrDone: visibleHouses.filter((h) => h.status !== "em_acompanhamento").length,
    done: visibleHouses.filter((h) => h.status === "virou_celula").length,
  };

  async function handleHouseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const cellId = String(formData.get("cellId") || "") || undefined;
    const pairId = String(formData.get("pairId") || "") || undefined;
    const ageRaw = String(formData.get("age") || "").trim();

    const result = await addPeaceHouse({
      churchId: currentUser.churchId,
      cellId,
      fullName: String(formData.get("fullName") || "").trim(),
      age: ageRaw ? Number(ageRaw) : undefined,
      sex: (String(formData.get("sex") || "") || undefined) as "feminino" | "masculino" | undefined,
      phone: String(formData.get("phone") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      houseNumber: String(formData.get("houseNumber") || "").trim(),
      neighborhood: String(formData.get("neighborhood") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      pairId,
      createdBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.house) {
      toast.error(`Nao consegui cadastrar a casa: ${result.error}`);
      return;
    }

    if (pairId) {
      await updatePeacePairLink({ pairId, houseId: result.house.id, persistToSupabase: !isDemoMode });
    }

    toast.success("Casa do Lar de Paz cadastrada.");
    setHouseFormOpen(false);
    form.reset();
  }

  async function handleHouseEditSubmit(event: FormEvent<HTMLFormElement>, houseId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const ageRaw = String(formData.get("age") || "").trim();

    const result = await updatePeaceHouseDetails({
      houseId,
      cellId: String(formData.get("cellId") || "") || undefined,
      fullName: String(formData.get("fullName") || "").trim(),
      age: ageRaw ? Number(ageRaw) : undefined,
      sex: (String(formData.get("sex") || "") || undefined) as "feminino" | "masculino" | undefined,
      phone: String(formData.get("phone") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      houseNumber: String(formData.get("houseNumber") || "").trim(),
      neighborhood: String(formData.get("neighborhood") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      toast.error(`Nao consegui salvar as alteracoes: ${result.error}`);
      return;
    }

    toast.success("Casa atualizada.");
    setEditingHouseId(null);
  }

  async function handleDeleteHouse(house: PeaceHouse) {
    const confirmed = await confirm({
      title: `Excluir ${house.fullName}?`,
      description: "Isso remove a casa e o historico de visitas dela. Nao pode ser desfeito.",
      confirmLabel: "Excluir casa",
      tone: "danger",
    });
    if (!confirmed) return;

    const result = await deletePeaceHouse({ houseId: house.id, persistToSupabase: !isDemoMode });
    if (!result.ok) {
      toast.error(`Nao consegui excluir: ${result.error}`);
      return;
    }
    toast.success("Casa excluida.");
  }

  async function handlePairSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const cellId = String(formData.get("cellId") || "");
    const houseId = String(formData.get("houseId") || "") || undefined;
    const cell = visibleCells.find((item) => item.id === cellId);

    if (!cell) {
      toast.error("Escolha a celula a qual a dupla pertence.");
      return;
    }

    const result = await addPeacePair({
      churchId: currentUser.churchId,
      cellId,
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      houseId,
      createdBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.pair) {
      toast.error(`Nao consegui cadastrar a dupla: ${result.error}`);
      return;
    }

    if (houseId) {
      await updatePeaceHouseLink({ houseId, pairId: result.pair.id, persistToSupabase: !isDemoMode });
    }

    toast.success("Dupla do Lar de Paz cadastrada.");
    setPairFormOpen(false);
    form.reset();
    setPairFormCellId(visibleCells[0]?.id ?? "");
  }

  async function handlePairEditSubmit(event: FormEvent<HTMLFormElement>, pairId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const result = await updatePeacePairDetails({
      pairId,
      cellId: String(formData.get("cellId") || ""),
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      toast.error(`Nao consegui salvar as alteracoes: ${result.error}`);
      return;
    }

    toast.success("Dupla atualizada.");
    setEditingPairId(null);
  }

  async function handleDeletePair(pairId: string, pairName: string) {
    const confirmed = await confirm({
      title: `Excluir ${pairName}?`,
      description: "Isso remove a dupla do Lar de Paz. Nao pode ser desfeito.",
      confirmLabel: "Excluir dupla",
      tone: "danger",
    });
    if (!confirmed) return;

    const result = await deletePeacePair({ pairId, persistToSupabase: !isDemoMode });
    if (!result.ok) {
      toast.error(`Nao consegui excluir: ${result.error}`);
      return;
    }
    toast.success("Dupla excluida.");
  }

  async function confirmMatch() {
    if (!matchingHouseId || !matchingPairId) return;

    const [houseResult, pairResult] = await Promise.all([
      updatePeaceHouseLink({ houseId: matchingHouseId, pairId: matchingPairId, persistToSupabase: !isDemoMode }),
      updatePeacePairLink({ pairId: matchingPairId, houseId: matchingHouseId, persistToSupabase: !isDemoMode }),
    ]);

    if (!houseResult.ok || !pairResult.ok) {
      toast.error("Nao consegui vincular a casa com a dupla.");
      return;
    }

    toast.success("Casa e dupla vinculadas.");
    setMatchingHouseId(null);
    setMatchingPairId(null);
  }

  async function handleVisitSubmit(event: FormEvent<HTMLFormElement>, houseId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const acceptedRaw = String(formData.get("acceptedJesus") || "");
    const wantsRaw = String(formData.get("wantsCell") || "");

    const result = await addVisit({
      houseId,
      acceptedJesus: acceptedRaw ? acceptedRaw === "sim" : null,
      wantsCell: wantsRaw ? wantsRaw === "sim" : null,
      notes: String(formData.get("notes") || "").trim() || undefined,
    });

    if (!result.ok) {
      toast.error(`Nao consegui salvar a visita: ${result.error}`);
      return;
    }

    toast.success("Visita registrada.");
    setVisitHouseId(null);
    form.reset();
  }

  async function openVisitHistory(houseId: string) {
    if (!visitHistory[houseId]) {
      const visits = await loadVisits(houseId);
      setVisitHistory((current) => ({ ...current, [houseId]: visits }));
    }
    setVisitHouseId(houseId);
  }

  async function handlePromoteSubmit(event: FormEvent<HTMLFormElement>, houseId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const result = await promoteToCell({
      houseId,
      cellName: String(formData.get("cellName") || "").trim(),
      meetingDay: String(formData.get("meetingDay") || "").trim() || undefined,
      meetingTime: String(formData.get("meetingTime") || "").trim() || undefined,
    });

    if (!result.ok) {
      toast.error(`Nao consegui promover a casa a celula: ${result.error}`);
      return;
    }

    toast.success("Casa promovida a celula! Ajuste lider e supervisor em Celulas.");
    setPromoteHouseId(null);
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow={roleLabels[currentUser.role]}
          title="Lar de Paz"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPairFormOpen(false);
                  setHouseFormOpen((v) => !v);
                }}
                className="flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-900 px-3 text-xs font-black text-white shadow-sm"
              >
                <Home size={15} />
                Nova casa
              </button>
              <button
                onClick={() => {
                  setHouseFormOpen(false);
                  setPairFormOpen((v) => !v);
                }}
                className="flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-black text-white shadow-sm"
              >
                <Users size={15} />
                Nova dupla
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <Home size={20} className="text-emerald-200" />
            <p className="mt-3 text-2xl font-semibold">{funnel.total}</p>
            <p className="text-sm text-slate-300">Casas cadastradas</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <Users size={20} className="text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{visiblePairs.length}</p>
            <p className="text-sm text-slate-500">Duplas cadastradas</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <Sparkles size={20} className="text-amber-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{funnel.readyOrDone}</p>
            <p className="text-sm text-slate-500">Prontas ou viraram celula</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <CheckCircle2 size={20} className="text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{funnel.done}</p>
            <p className="text-sm text-slate-500">Viraram celula</p>
          </div>
        </div>

        {(unmatchedHouses.length > 0 || unmatchedPairs.length > 0) && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Link2 size={18} className="text-amber-800" />
              <h3 className="text-sm font-black uppercase text-amber-900">Pendencias para vincular</h3>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase text-amber-700">Casas sem dupla ({unmatchedHouses.length})</p>
                <div className="mt-2 space-y-2">
                  {unmatchedHouses.map((house) => (
                    <div key={house.id} className="rounded-lg bg-white/80 p-2.5 text-sm">
                      <p className="font-bold text-slate-900">{house.fullName}</p>
                      {matchingHouseId === house.id ? (
                        <div className="mt-2 flex flex-col gap-2">
                          <select
                            value={matchingPairId ?? ""}
                            onChange={(event) => setMatchingPairId(event.target.value || null)}
                            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"
                          >
                            <option value="">Escolha uma dupla</option>
                            {unmatchedPairs.map((pair) => (
                              <option key={pair.id} value={pair.id}>
                                {pair.name}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={confirmMatch}
                              disabled={!matchingPairId}
                              className="flex-1 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => {
                                setMatchingHouseId(null);
                                setMatchingPairId(null);
                              }}
                              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setMatchingHouseId(house.id)}
                          disabled={unmatchedPairs.length === 0}
                          className="mt-1 text-xs font-black text-emerald-800 underline disabled:text-slate-400 disabled:no-underline"
                        >
                          Vincular uma dupla
                        </button>
                      )}
                    </div>
                  ))}
                  {unmatchedHouses.length === 0 && <p className="text-xs font-semibold text-amber-700">Nenhuma pendencia.</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-amber-700">Duplas sem casa ({unmatchedPairs.length})</p>
                <div className="mt-2 space-y-2">
                  {unmatchedPairs.map((pair) => (
                    <div key={pair.id} className="rounded-lg bg-white/80 p-2.5 text-sm">
                      <p className="font-bold text-slate-900">{pair.name}</p>
                      <p className="text-xs font-semibold text-amber-700">Aguardando casa disponivel</p>
                    </div>
                  ))}
                  {unmatchedPairs.length === 0 && <p className="text-xs font-semibold text-amber-700">Nenhuma pendencia.</p>}
                </div>
              </div>
            </div>
          </section>
        )}

        {houseFormOpen && (
          <form onSubmit={handleHouseSubmit} className="native-form rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Nova casa" title="Cadastro de Casa - Lar de Paz" />
            <div className="space-y-3">
              <input name="fullName" required placeholder="Nome completo" className={fieldClass} />
              <div className="grid grid-cols-2 gap-3">
                <input name="age" type="number" min={0} placeholder="Idade" className={fieldClass} />
                <select name="sex" defaultValue="" className={selectClass}>
                  <option value="">Sexo</option>
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                </select>
              </div>
              <input name="phone" placeholder="Telefone" className={fieldClass} />
              <input name="address" required placeholder="Endereco completo" className={fieldClass} />
              <div className="grid grid-cols-2 gap-3">
                <input name="houseNumber" placeholder="Numero da casa" className={fieldClass} />
                <input name="neighborhood" placeholder="Bairro" className={fieldClass} />
              </div>
              <input name="city" placeholder="Cidade" className={fieldClass} />
              <select name="cellId" defaultValue="" className={selectClass}>
                <option value="">Sem celula vinculada</option>
                {visibleCells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name}
                  </option>
                ))}
              </select>
              <div>
                <p className="mb-1 text-xs font-bold uppercase text-slate-400">A casa ja possui uma dupla do Lar de Paz?</p>
                <select name="pairId" defaultValue="" className={selectClass}>
                  <option value="">Nao possui dupla ainda</option>
                  {visiblePairs.map((pair) => (
                    <option key={pair.id} value={pair.id}>
                      {pair.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="primary-action mt-4">
              <Home size={18} />
              Cadastrar casa
            </button>
          </form>
        )}

        {pairFormOpen && (
          <form onSubmit={handlePairSubmit} className="native-form rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Nova dupla" title="Cadastro de Duplas - Lar de Paz" />
            <div className="space-y-3">
              <input name="name" required placeholder="Nome da dupla" className={fieldClass} />
              <input name="phone" placeholder="Telefone" className={fieldClass} />
              <select
                name="cellId"
                required
                value={pairFormCellId}
                onChange={(event) => setPairFormCellId(event.target.value)}
                className={selectClass}
              >
                <option value="" disabled>
                  Celula a qual pertence
                </option>
                {visibleCells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <ShieldCheck size={16} className="shrink-0 text-emerald-700" />
                Supervisor(a):{" "}
                <span className="font-semibold text-slate-800">
                  {profiles.find((profile) => profile.id === visibleCells.find((c) => c.id === pairFormCellId)?.supervisorUserId)
                    ?.name ?? "Sem supervisor atribuido"}
                </span>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase text-slate-400">A dupla ja possui uma Casa do Lar de Paz?</p>
                <select name="houseId" defaultValue="" className={selectClass}>
                  <option value="">Nao possui casa ainda</option>
                  {visibleHousesForSelect(visibleHouses)}
                </select>
              </div>
            </div>
            <button className="primary-action mt-4">
              <Users size={18} />
              Cadastrar dupla
            </button>
          </form>
        )}

        <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setTab("casas")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-black transition ${
              tab === "casas" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
            }`}
          >
            Casas ({visibleHouses.length})
          </button>
          <button
            onClick={() => setTab("duplas")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-black transition ${
              tab === "duplas" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
            }`}
          >
            Duplas ({visiblePairs.length})
          </button>
        </div>

        {tab === "casas" && (
          <section className="grid gap-3 lg:grid-cols-2">
            {sortedHouses.map((house) => {
              const cell = visibleCells.find((item) => item.id === house.cellId);
              const pair = visiblePairs.find((item) => item.id === house.pairId);

              return (
                <article key={house.id} className="rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold leading-tight text-slate-950">{house.fullName}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin size={14} />
                        {house.address}
                        {house.houseNumber ? `, ${house.houseNumber}` : ""}
                      </p>
                      {house.phone && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                          <Phone size={14} />
                          {house.phone}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={`rounded-lg px-2 py-1 text-xs font-bold ${
                          house.hasPair ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {house.hasPair ? "Com dupla" : "Sem dupla"}
                      </span>
                      <span className={`rounded-lg px-2 py-1 text-xs font-bold ${STATUS_TONES[house.status]}`}>
                        {STATUS_LABELS[house.status]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    <p>{house.neighborhood || "Sem bairro"} - {house.city || "Sem cidade"}</p>
                    <p>{cell?.name ?? "Sem celula vinculada"}</p>
                    {pair && <p className="font-semibold text-emerald-700">Dupla: {pair.name}</p>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => openVisitHistory(house.id)}
                      className="flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-black text-white"
                    >
                      <ClipboardList size={14} />
                      Visitas
                    </button>
                    {canManageChurchWide && house.status === "pronta_para_celula" && (
                      <button
                        onClick={() => setPromoteHouseId(house.id)}
                        className="flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-900 px-3 text-xs font-black text-white"
                      >
                        <Sparkles size={14} />
                        Promover a celula
                      </button>
                    )}
                    <button
                      onClick={() => setEditingHouseId(editingHouseId === house.id ? null : house.id)}
                      className="flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-black text-slate-600 shadow-sm"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteHouse(house)}
                      className="flex min-h-10 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-black text-rose-800"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>

                  {editingHouseId === house.id && (
                    <form
                      onSubmit={(event) => handleHouseEditSubmit(event, house.id)}
                      className="native-form mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <input name="fullName" required defaultValue={house.fullName} placeholder="Nome completo" className={fieldClass} />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="age" type="number" min={0} defaultValue={house.age ?? ""} placeholder="Idade" className={fieldClass} />
                        <select name="sex" defaultValue={house.sex ?? ""} className={selectClass}>
                          <option value="">Sexo</option>
                          <option value="feminino">Feminino</option>
                          <option value="masculino">Masculino</option>
                        </select>
                      </div>
                      <input name="phone" defaultValue={house.phone} placeholder="Telefone" className={fieldClass} />
                      <input name="address" required defaultValue={house.address} placeholder="Endereco" className={fieldClass} />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="houseNumber" defaultValue={house.houseNumber} placeholder="Numero" className={fieldClass} />
                        <input name="neighborhood" defaultValue={house.neighborhood} placeholder="Bairro" className={fieldClass} />
                      </div>
                      <input name="city" defaultValue={house.city} placeholder="Cidade" className={fieldClass} />
                      <select name="cellId" defaultValue={house.cellId ?? ""} className={selectClass}>
                        <option value="">Sem celula vinculada</option>
                        {visibleCells.map((cell) => (
                          <option key={cell.id} value={cell.id}>
                            {cell.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button className="flex-1 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-black text-white">Salvar</button>
                        <button type="button" onClick={() => setEditingHouseId(null)} className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-black text-slate-600">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  {visitHouseId === house.id && (
                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase text-slate-500">Historico de visitas</p>
                      <div className="mt-2 space-y-2">
                        {(visitHistory[house.id] ?? []).map((visit) => (
                          <div key={visit.id} className="rounded-lg bg-white p-2 text-xs">
                            <p className="font-bold text-slate-700">
                              {new Intl.DateTimeFormat("pt-BR").format(new Date(visit.visitedAt))}
                              {visit.acceptedJesus === true && " - Aceitou Jesus"}
                              {visit.wantsCell === true && " - Quer celula"}
                            </p>
                            {visit.notes && <p className="mt-0.5 text-slate-500">{visit.notes}</p>}
                          </div>
                        ))}
                        {(visitHistory[house.id] ?? []).length === 0 && (
                          <p className="text-xs font-semibold text-slate-400">Nenhuma visita registrada ainda.</p>
                        )}
                      </div>

                      <form
                        onSubmit={(event) => handleVisitSubmit(event, house.id)}
                        className="native-form mt-3 space-y-2 border-t border-slate-200 pt-3"
                      >
                        <p className="text-xs font-black uppercase text-slate-500">Registrar nova visita</p>
                        <div className="grid grid-cols-2 gap-2">
                          <select name="acceptedJesus" defaultValue="" className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold">
                            <option value="">Aceitou Jesus?</option>
                            <option value="sim">Sim</option>
                            <option value="nao">Ainda nao</option>
                          </select>
                          <select name="wantsCell" defaultValue="" className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold">
                            <option value="">Quer uma celula?</option>
                            <option value="sim">Sim</option>
                            <option value="nao">Ainda nao</option>
                          </select>
                        </div>
                        <textarea
                          name="notes"
                          rows={2}
                          placeholder="Observacoes da visita..."
                          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-500"
                        />
                        <div className="flex gap-2">
                          <button className="flex-1 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-black text-white">Salvar visita</button>
                          <button
                            type="button"
                            onClick={() => setVisitHouseId(null)}
                            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
                          >
                            Fechar
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {promoteHouseId === house.id && (
                    <form
                      onSubmit={(event) => handlePromoteSubmit(event, house.id)}
                      className="native-form mt-3 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3"
                    >
                      <p className="text-xs font-black uppercase text-emerald-800">Promover casa a celula</p>
                      <input
                        name="cellName"
                        required
                        defaultValue={`Celula ${house.fullName}`}
                        placeholder="Nome da nova celula"
                        className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-emerald-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="meetingDay" placeholder="Dia (ex: Terca)" className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-emerald-500" />
                        <input name="meetingTime" placeholder="Horario (ex: 20h)" className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-emerald-500" />
                      </div>
                      <p className="text-[11px] font-semibold text-emerald-800">Endereco e bairro sao copiados da casa. Defina lider e supervisor depois em Celulas.</p>
                      <div className="flex gap-2">
                        <button className="flex-1 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-black text-white">Criar celula</button>
                        <button
                          type="button"
                          onClick={() => setPromoteHouseId(null)}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}

            {sortedHouses.length === 0 && (
              <div className="lg:col-span-2">
                <EmptyState icon={Home} title="Nenhuma casa do Lar de Paz visivel" description="Cadastre a primeira casa para comecar o acompanhamento." />
              </div>
            )}
          </section>
        )}

        {tab === "duplas" && (
          <section className="grid gap-3 lg:grid-cols-2">
            {sortedPairs.map((pair) => {
              const cell = visibleCells.find((item) => item.id === pair.cellId);
              const supervisorName = cell ? profiles.find((profile) => profile.id === cell.supervisorUserId)?.name : undefined;
              const house = visibleHouses.find((item) => item.id === pair.houseId);

              return (
                <article key={pair.id} className="rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold leading-tight text-slate-950">{pair.name}</h3>
                      {pair.phone && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                          <Phone size={14} />
                          {pair.phone}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                        pair.hasHouse ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {pair.hasHouse ? "Com casa" : "Sem casa"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    <p>{cell?.name ?? "Sem celula"}</p>
                    <p>Supervisor(a): {supervisorName ?? "Sem supervisor atribuido"}</p>
                    {house && <p className="font-semibold text-emerald-700">Casa: {house.fullName}</p>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditingPairId(editingPairId === pair.id ? null : pair.id)}
                      className="flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-black text-slate-600 shadow-sm"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeletePair(pair.id, pair.name)}
                      className="flex min-h-10 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-black text-rose-800"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>

                  {editingPairId === pair.id && (
                    <form
                      onSubmit={(event) => handlePairEditSubmit(event, pair.id)}
                      className="native-form mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <input name="name" required defaultValue={pair.name} placeholder="Nome da dupla" className={fieldClass} />
                      <input name="phone" defaultValue={pair.phone} placeholder="Telefone" className={fieldClass} />
                      <select name="cellId" required defaultValue={pair.cellId} className={selectClass}>
                        {visibleCells.map((cellOption) => (
                          <option key={cellOption.id} value={cellOption.id}>
                            {cellOption.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button className="flex-1 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-black text-white">Salvar</button>
                        <button type="button" onClick={() => setEditingPairId(null)} className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-black text-slate-600">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}

            {sortedPairs.length === 0 && (
              <div className="lg:col-span-2">
                <EmptyState icon={Users} title="Nenhuma dupla do Lar de Paz visivel" description="Cadastre a primeira dupla para comecar o acompanhamento." />
              </div>
            )}
          </section>
        )}
      </section>
    </AppShell>
  );
}

function visibleHousesForSelect(houses: PeaceHouse[]) {
  return houses.map((house) => (
    <option key={house.id} value={house.id}>
      {house.fullName}
    </option>
  ));
}
