"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Home, Phone, Plus, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { getScopedCells, getScopedPeaceHouses, getScopedPeacePairs } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";
import { useCells, usePeaceHouses, usePeacePairs, useProfiles } from "@/lib/local-store";

export default function PeacePairsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { profiles } = useProfiles();
  const { pairs, addPeacePair } = usePeacePairs();
  const { houses, updatePeaceHouseLink } = usePeaceHouses();
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visiblePairs = getScopedPeacePairs(currentUser, pairs, cells, isDemoMode);
  const visibleHouses = getScopedPeaceHouses(currentUser, houses, cells, isDemoMode);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [formCellId, setFormCellId] = useState(visibleCells[0]?.id ?? "");
  const sortedPairs = [...visiblePairs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const formCell = visibleCells.find((cell) => cell.id === formCellId);
  const formSupervisorName = formCell
    ? profiles.find((profile) => profile.id === formCell.supervisorUserId)?.name
    : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    setOpen(false);
    form.reset();
    setFormCellId(visibleCells[0]?.id ?? "");
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow={roleLabels[currentUser.role]}
          title="Lar de Paz - Duplas"
          action={
            <button
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm"
              aria-label="Nova dupla"
            >
              <Plus size={18} />
            </button>
          }
        />

        <Link
          href="/lar-de-paz"
          className="flex items-center justify-between rounded-lg border border-white/80 bg-white/90 p-4 text-sm font-bold text-slate-700 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <Home size={18} className="text-emerald-800" />
            Ver casas do Lar de Paz
          </span>
          <span className="text-emerald-700">{visibleHouses.length}</span>
        </Link>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <Users size={20} className="text-emerald-200" />
            <p className="mt-3 text-2xl font-semibold">{visiblePairs.length}</p>
            <p className="text-sm text-slate-300">Duplas cadastradas</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <Home size={20} className="text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {visiblePairs.filter((pair) => pair.hasHouse).length}
            </p>
            <p className="text-sm text-slate-500">Com casa</p>
          </div>
        </div>

        {open && (
          <form onSubmit={handleSubmit} className="native-form rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Nova dupla" title="Cadastro de Duplas - Lar de Paz" />
            <div className="space-y-3">
              <input
                name="name"
                required
                placeholder="Nome da dupla"
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <input
                name="phone"
                placeholder="Telefone"
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <select
                name="cellId"
                required
                value={formCellId}
                onChange={(event) => setFormCellId(event.target.value)}
                className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
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
                Supervisor(a): <span className="font-semibold text-slate-800">{formSupervisorName ?? "Sem supervisor atribuido"}</span>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase text-slate-400">A dupla ja possui uma Casa do Lar de Paz?</p>
                <select
                  name="houseId"
                  defaultValue=""
                  className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  <option value="">Nao possui casa ainda</option>
                  {visibleHouses.map((house) => (
                    <option key={house.id} value={house.id}>
                      {house.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="primary-action mt-4">
              <Users size={18} />
              Cadastrar dupla
            </button>
          </form>
        )}

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
              </article>
            );
          })}

          {sortedPairs.length === 0 && (
            <div className="rounded-lg border border-white/80 bg-white/90 p-5 text-center shadow-sm lg:col-span-2">
              <Users className="mx-auto text-slate-300" size={30} />
              <p className="mt-3 text-sm font-semibold text-slate-500">Nenhuma dupla do Lar de Paz visivel para seu acesso.</p>
            </div>
          )}
        </section>
      </section>
    </AppShell>
  );
}
