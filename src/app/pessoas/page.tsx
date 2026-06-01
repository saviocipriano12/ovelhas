"use client";

import { FormEvent, useMemo, useState } from "react";
import { Copy, Filter, MessageCircle, Plus, Share2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PersonCard } from "@/components/person-card";
import { SectionHeader } from "@/components/section-header";
import { canManagePeople, getScopedCells, getScopedPeople } from "@/lib/access-control";
import { useCells, useInvites, useLocalPeople } from "@/lib/local-store";
import { whatsappLink } from "@/lib/whatsapp";

function inviteUrl(token: string) {
  if (typeof window === "undefined") {
    return `/convite/${token}`;
  }

  return `${window.location.origin}/convite/${token}`;
}

export default function PeoplePage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people, addPerson, refreshPeople, isLoadingPeople, peopleLoadError } = useLocalPeople();
  const { cells, refreshCells } = useCells();
  const { createInvite } = useInvites();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [lastInviteName, setLastInviteName] = useState("");
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);

    if (!normalizedQuery) {
      return visiblePeople;
    }

    return visiblePeople.filter((person) =>
      [person.name, person.stage, person.status, person.neighborhood]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [currentUser, isDemoMode, people, query]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const stage = String(formData.get("stage") || "Visitante");
    const neighborhood = String(formData.get("neighborhood") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const birthDate = String(formData.get("birthDate") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const familyPhone = String(formData.get("familyPhone") || "").trim();
    const cellId = String(formData.get("cellId") || visibleCells[0]?.id || "");
    const selectedCell = visibleCells.find((cell) => cell.id === cellId);

    if (!name || !phone) {
      return;
    }

    const result = await addPerson({
      name,
      phone,
      stage,
      neighborhood,
      email,
      birthDate,
      address,
      familyPhone,
      createdByUserId: currentUser.id,
      leaderUserId: selectedCell?.leaderUserId || (currentUser.role === "leader" ? currentUser.id : undefined),
      churchId: currentUser.churchId,
      cellId: selectedCell?.id || currentUser.cellIds?.[0] || "cell-casa-da-paz",
      cellName: selectedCell?.name,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.person) {
      setCreated(`Nao consegui cadastrar: ${result.error}`);
      return;
    }

    setCreated(`${result.person.name} foi adicionado ao cuidado da celula.`);

    const inviteResult = await createInvite({
      churchId: currentUser.churchId,
      name: result.person.name,
      email: result.person.email,
      role: "member",
      cellId: result.person.cellId,
      personId: result.person.id,
      createdBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    if (inviteResult.ok && inviteResult.invite) {
      setLastInviteLink(inviteUrl(inviteResult.invite.token));
      setLastInviteName(result.person.name);
      setCreated(`${result.person.name} foi cadastrado. Convite pronto para enviar ao membro.`);
    } else {
      setCreated(`${result.person.name} foi cadastrado, mas nao consegui gerar convite: ${inviteResult.error}`);
    }

    await Promise.all([refreshPeople(), refreshCells()]);
    setOpen(false);
    event.currentTarget.reset();
  }

  async function copyLastInvite() {
    await navigator.clipboard?.writeText(lastInviteLink);
    setCreated("Link do convite copiado.");
  }

  async function shareLastInvite() {
    const text = `Ola, ${lastInviteName}! Aqui esta seu convite para entrar no Ovelhas: ${lastInviteLink}`;

    if (navigator.share) {
      await navigator.share({ title: `Convite Ovelhas - ${lastInviteName}`, text, url: lastInviteLink });
      return;
    }

    await navigator.clipboard?.writeText(text);
    setCreated("Mensagem do convite copiada.");
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

        {lastInviteLink && (
          <section className="rounded-[24px] border border-emerald-100 bg-white/95 p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-emerald-700">Convite do membro</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{lastInviteName}</h3>
            <p className="mt-2 break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{lastInviteLink}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={copyLastInvite} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-xs font-black text-white">
                <Copy size={15} />
                Copiar
              </button>
              <button onClick={shareLastInvite} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-3 text-xs font-black text-white">
                <Share2 size={15} />
                Enviar
              </button>
              <a
                href={whatsappLink("", `Ola, ${lastInviteName}! Aqui esta seu convite para entrar no Ovelhas: ${lastInviteLink}`)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-3 text-xs font-black text-white"
              >
                <MessageCircle size={15} />
                WhatsApp
              </a>
            </div>
          </section>
        )}

        {peopleLoadError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
            Nao consegui carregar pessoas do Supabase: {peopleLoadError}
          </div>
        )}

        {isLoadingPeople && (
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
            Atualizando pessoas...
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
          <div className="fixed inset-0 z-[999] flex items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-3">
            <form
              onSubmit={handleSubmit}
              className="mobile-sheet native-scroll app-scrollbar animate-enter"
            >
              <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center justify-between gap-3 rounded-b-2xl bg-white/95 px-1 pb-3 pt-2 backdrop-blur">
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
                  className="field-control"
                  placeholder="Nome completo"
                />
                <input
                  name="phone"
                  required
                  inputMode="tel"
                  className="field-control"
                  placeholder="WhatsApp com DDD"
                />
                <input
                  name="email"
                  type="email"
                  className="field-control"
                  placeholder="Email opcional"
                />
                <input
                  name="birthDate"
                  type="date"
                  className="field-control"
                  aria-label="Data de nascimento"
                />
                <input
                  name="neighborhood"
                  className="field-control"
                  placeholder="Bairro"
                />
                <input
                  name="address"
                  className="field-control"
                  placeholder="Endereco completo"
                />
                <input
                  name="familyPhone"
                  inputMode="tel"
                  className="field-control"
                  placeholder="Telefone de familiar"
                />
                <select
                  name="cellId"
                  className="field-control"
                >
                  {visibleCells.map((cell) => (
                    <option key={cell.id} value={cell.id}>
                      {cell.name}
                    </option>
                  ))}
                </select>
                <select
                  name="stage"
                  className="field-control"
                >
                  <option>Visitante</option>
                  <option>Novo membro</option>
                  <option>Em discipulado</option>
                  <option>Batismo</option>
                  <option>Servindo</option>
                </select>
              </div>

              <button className="primary-action mt-4">
                Salvar pessoa
              </button>
            </form>
          </div>
        )}
      </section>
    </AppShell>
  );
}
