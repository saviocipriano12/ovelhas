"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Home, MapPin, Phone, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { getScopedCells, getScopedPeaceHouses, getScopedPeacePairs } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";
import { useCells, usePeaceHouses, usePeacePairs } from "@/lib/local-store";

export default function PeaceHousesPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { houses, addPeaceHouse } = usePeaceHouses();
  const { pairs, updatePeacePairLink } = usePeacePairs();
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleHouses = getScopedPeaceHouses(currentUser, houses, cells, isDemoMode);
  const visiblePairs = getScopedPeacePairs(currentUser, pairs, cells, isDemoMode);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const sortedHouses = [...visibleHouses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    setOpen(false);
    form.reset();
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow={roleLabels[currentUser.role]}
          title="Lar de Paz - Casas"
          action={
            <button
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm"
              aria-label="Nova casa"
            >
              <Plus size={18} />
            </button>
          }
        />

        <Link
          href="/lar-de-paz/duplas"
          className="flex items-center justify-between rounded-lg border border-white/80 bg-white/90 p-4 text-sm font-bold text-slate-700 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <Users size={18} className="text-emerald-800" />
            Ver duplas do Lar de Paz
          </span>
          <span className="text-emerald-700">{visiblePairs.length}</span>
        </Link>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <Home size={20} className="text-emerald-200" />
            <p className="mt-3 text-2xl font-semibold">{visibleHouses.length}</p>
            <p className="text-sm text-slate-300">Casas cadastradas</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <Users size={20} className="text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {visibleHouses.filter((house) => house.hasPair).length}
            </p>
            <p className="text-sm text-slate-500">Com dupla</p>
          </div>
        </div>

        {open && (
          <form onSubmit={handleSubmit} className="native-form rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Nova casa" title="Cadastro de Casa - Lar de Paz" />
            <div className="space-y-3">
              <input
                name="fullName"
                required
                placeholder="Nome completo"
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="age"
                  type="number"
                  min={0}
                  placeholder="Idade"
                  className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
                <select
                  name="sex"
                  defaultValue=""
                  className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  <option value="">Sexo</option>
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                </select>
              </div>
              <input
                name="phone"
                placeholder="Telefone"
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <input
                name="address"
                required
                placeholder="Endereco completo"
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="houseNumber"
                  placeholder="Numero da casa"
                  className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
                <input
                  name="neighborhood"
                  placeholder="Bairro"
                  className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <input
                name="city"
                placeholder="Cidade"
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <select
                name="cellId"
                defaultValue=""
                className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                <option value="">Sem celula vinculada</option>
                {visibleCells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name}
                  </option>
                ))}
              </select>
              <div>
                <p className="mb-1 text-xs font-bold uppercase text-slate-400">A casa ja possui uma dupla do Lar de Paz?</p>
                <select
                  name="pairId"
                  defaultValue=""
                  className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
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
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                      house.hasPair ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {house.hasPair ? "Com dupla" : "Sem dupla"}
                  </span>
                </div>

                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                  <p>{house.neighborhood || "Sem bairro"} - {house.city || "Sem cidade"}</p>
                  <p>{cell?.name ?? "Sem celula vinculada"}</p>
                  {pair && <p className="font-semibold text-emerald-700">Dupla: {pair.name}</p>}
                </div>
              </article>
            );
          })}

          {sortedHouses.length === 0 && (
            <div className="rounded-lg border border-white/80 bg-white/90 p-5 text-center shadow-sm lg:col-span-2">
              <Home className="mx-auto text-slate-300" size={30} />
              <p className="mt-3 text-sm font-semibold text-slate-500">Nenhuma casa do Lar de Paz visivel para seu acesso.</p>
            </div>
          )}
        </section>
      </section>
    </AppShell>
  );
}
