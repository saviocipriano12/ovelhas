"use client";

import { FormEvent, useMemo, useState } from "react";
import { Filter, Plus, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PersonCard } from "@/components/person-card";
import { SectionHeader } from "@/components/section-header";
import { canManagePeople, getVisibleCells, getVisiblePeople } from "@/lib/access-control";
import { useCells, useLocalPeople } from "@/lib/local-store";

export default function PeoplePage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people, addPerson } = useLocalPeople();
  const { cells } = useCells();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState("");
  const visibleCells = getVisibleCells(currentUser, cells);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visiblePeople = getVisiblePeople(currentUser, people);

    if (!normalizedQuery) {
      return visiblePeople;
    }

    return visiblePeople.filter((person) =>
      [person.name, person.stage, person.status, person.neighborhood]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [currentUser, people, query]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const stage = String(formData.get("stage") || "Visitante");
    const neighborhood = String(formData.get("neighborhood") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const cellId = String(formData.get("cellId") || visibleCells[0]?.id || "");
    const selectedCell = visibleCells.find((cell) => cell.id === cellId);

    if (!name || !phone) {
      return;
    }

    const person = await addPerson({
      name,
      phone,
      stage,
      neighborhood,
      email,
      createdByUserId: currentUser.id,
      leaderUserId: selectedCell?.leaderUserId || (currentUser.role === "leader" ? currentUser.id : undefined),
      churchId: currentUser.churchId,
      cellId: selectedCell?.id || currentUser.cellIds?.[0] || "cell-casa-da-paz",
      cellName: selectedCell?.name,
      persistToSupabase: !isDemoMode,
    });
    setCreated(`${person.name} foi adicionado ao cuidado da celula.`);
    setOpen(false);
    event.currentTarget.reset();
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-4">
        <SectionHeader
          eyebrow="Celula"
          title="Pessoas acompanhadas"
          action={
            canManagePeople(currentUser) ? (
              <button
                onClick={() => setOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm"
                aria-label="Adicionar pessoa"
              >
                <Plus size={18} />
              </button>
            ) : null
          }
        />

        <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
          {["Todos", "Visitantes", "Em discipulado", "Sem contato", "Batismo"].map((filter) => (
            <button
              key={filter}
              className="shrink-0 rounded-lg border border-white/80 bg-white/90 px-3 py-2 text-sm font-bold text-slate-600 shadow-sm"
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-white/80 bg-white/75 p-3 shadow-sm">
          <label className="flex min-h-12 items-center gap-3 rounded-lg bg-slate-100 px-3 text-sm text-slate-500">
            <Filter size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Buscar por nome, status ou bairro"
            />
          </label>
        </div>

        {created && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            {created}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredPeople.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>

        {filteredPeople.length === 0 && (
          <div className="rounded-lg border border-white/80 bg-white/90 p-5 text-center text-sm font-medium text-slate-500">
            Nenhuma pessoa visivel para este perfil de acesso.
          </div>
        )}

        {open && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
            <form
              onSubmit={handleSubmit}
              className="animate-enter w-full rounded-[22px] bg-white p-5 shadow-2xl shadow-slate-900/20 sm:max-w-md"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-emerald-700">Novo cuidado</p>
                  <h2 className="text-xl font-semibold text-slate-950">Adicionar pessoa</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  name="name"
                  required
                  className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Nome completo"
                />
                <input
                  name="phone"
                  required
                  inputMode="tel"
                  className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="WhatsApp com DDD"
                />
                <input
                  name="email"
                  type="email"
                  className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Email opcional"
                />
                <input
                  name="neighborhood"
                  className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Bairro"
                />
                <select
                  name="cellId"
                  className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
                >
                  {visibleCells.map((cell) => (
                    <option key={cell.id} value={cell.id}>
                      {cell.name}
                    </option>
                  ))}
                </select>
                <select
                  name="stage"
                  className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option>Visitante</option>
                  <option>Novo membro</option>
                  <option>Em discipulado</option>
                  <option>Batismo</option>
                  <option>Servindo</option>
                </select>
              </div>

              <button className="mt-4 min-h-12 w-full rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
                Salvar pessoa
              </button>
            </form>
          </div>
        )}
      </section>
    </AppShell>
  );
}
