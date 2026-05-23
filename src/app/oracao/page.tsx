"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Heart, LockKeyhole, MessageCircle, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { getVisibleCells, getVisiblePeople, getVisiblePrayerRequests } from "@/lib/access-control";
import type { PrayerRequest } from "@/lib/data";
import { roleLabels } from "@/lib/data";
import { useActivityEvents, useCells, useLocalPeople, usePrayerRequests } from "@/lib/local-store";

function statusLabel(status: PrayerRequest["status"]) {
  if (status === "answered") {
    return "Respondido";
  }

  if (status === "prayed") {
    return "Orado";
  }

  return "Aberto";
}

function statusTone(status: PrayerRequest["status"]) {
  if (status === "answered") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "prayed") {
    return "bg-sky-100 text-sky-800";
  }

  return "bg-amber-100 text-amber-900";
}

function visibilityLabel(visibility: PrayerRequest["visibility"]) {
  const labels: Record<PrayerRequest["visibility"], string> = {
    leader_only: "Somente lider",
    leadership: "Lideranca",
    pastor_only: "Pastor/admin",
    cell_public: "Celula",
  };
  return labels[visibility];
}

export default function PrayerPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { requests, addPrayerRequest, updatePrayerStatus } = usePrayerRequests();
  const { addEvent } = useActivityEvents();
  const visiblePeople = getVisiblePeople(currentUser, people);
  const visibleCells = getVisibleCells(currentUser, cells);
  const visibleRequests = getVisiblePrayerRequests(currentUser, requests, cells, people);
  const memberPerson =
    people.find((person) => person.personUserId === currentUser.id || person.id === currentUser.personId) ??
    visiblePeople[0];
  const [open, setOpen] = useState(currentUser.role === "member");
  const [feedback, setFeedback] = useState("");
  const openRequests = visibleRequests.filter((request) => request.status === "open");
  const prayedRequests = visibleRequests.filter((request) => request.status === "prayed");
  const answeredRequests = visibleRequests.filter((request) => request.status === "answered");
  const peopleOptions = currentUser.role === "member" && memberPerson ? [memberPerson] : visiblePeople;
  const sortedRequests = [...visibleRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const personId = String(formData.get("personId") || memberPerson?.id || "");
    const person = people.find((item) => item.id === personId);

    if (!person) {
      setFeedback("Escolha uma pessoa para vincular o pedido.");
      return;
    }

    const result = await addPrayerRequest({
      churchId: person.churchId,
      personId: person.id,
      cellId: person.cellId,
      title: String(formData.get("title") || "").trim(),
      request: String(formData.get("request") || "").trim(),
      visibility: String(formData.get("visibility") || "leader_only") as PrayerRequest["visibility"],
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.request) {
      setFeedback(`Nao consegui registrar o pedido: ${result.error}`);
      return;
    }

    await addEvent({
      churchId: person.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Registrou pedido de oracao",
      description: `${currentUser.name} registrou um pedido de oracao para acompanhamento.`,
      targetType: "care",
      targetId: result.request.id,
      targetName: result.request.title,
      personId: person.id,
      cellId: person.cellId,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setFeedback("Pedido de oracao registrado.");
    setOpen(false);
    event.currentTarget.reset();
  }

  async function markStatus(request: PrayerRequest, status: PrayerRequest["status"]) {
    const result = await updatePrayerStatus({
      requestId: request.id,
      status,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui atualizar: ${result.error}`);
      return;
    }

    setFeedback(status === "answered" ? "Pedido marcado como respondido." : "Pedido marcado como orado.");
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow={roleLabels[currentUser.role]}
          title="Pedidos de oracao"
          action={
            <button
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm"
              aria-label="Novo pedido"
            >
              <Plus size={18} />
            </button>
          }
        />

        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-950">Cuidado com privacidade</p>
          <p className="mt-1 text-sm leading-5 text-emerald-800">
            Cada pedido pode ser visivel somente ao lider, a lideranca, ao pastor/admin ou a celula.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <Heart size={20} className="text-emerald-200" />
            <p className="mt-3 text-2xl font-semibold">{openRequests.length}</p>
            <p className="text-sm text-slate-300">Abertos</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <Sparkles size={20} className="text-sky-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{prayedRequests.length}</p>
            <p className="text-sm text-slate-500">Orados</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <CheckCircle2 size={20} className="text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{answeredRequests.length}</p>
            <p className="text-sm text-slate-500">Respondidos</p>
          </div>
        </div>

        {feedback && <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{feedback}</div>}

        {open && (
          <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Novo pedido" title="Como podemos orar?" />
            <div className="space-y-3">
              {currentUser.role !== "member" && (
                <select name="personId" className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  {peopleOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} - {person.cell}
                    </option>
                  ))}
                </select>
              )}
              <input name="title" required placeholder="Titulo curto" className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
              <textarea name="request" required rows={4} placeholder="Escreva o pedido com cuidado..." className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" />
              <select name="visibility" className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                <option value="leader_only">Somente meu lider</option>
                <option value="leadership">Lideranca</option>
                <option value="pastor_only">Somente pastor/admin</option>
                <option value="cell_public">Pode aparecer para a celula</option>
              </select>
            </div>
            <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
              <MessageCircle size={18} />
              Registrar pedido
            </button>
          </form>
        )}

        <section className="grid gap-3 lg:grid-cols-2">
          {sortedRequests.map((request) => {
            const person = people.find((item) => item.id === request.personId);
            const cell = visibleCells.find((item) => item.id === request.cellId);
            const canUpdate = currentUser.role !== "member";

            return (
              <article key={request.id} className="rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-lg px-2 py-1 text-xs font-bold ${statusTone(request.status)}`}>
                        {statusLabel(request.status)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                        <LockKeyhole size={12} />
                        {visibilityLabel(request.visibility)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold leading-tight text-slate-950">{request.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{request.request}</p>
                  </div>
                  <ShieldCheck className="shrink-0 text-emerald-700" size={20} />
                </div>

                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                  <p className="font-semibold text-slate-700">{person?.name ?? request.createdByName}</p>
                  <p>{cell?.name ?? person?.cell ?? "Sem celula"} - {new Intl.DateTimeFormat("pt-BR").format(new Date(request.createdAt))}</p>
                </div>

                {canUpdate && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => markStatus(request, "prayed")}
                      className="min-h-11 rounded-lg bg-sky-50 px-4 text-sm font-bold text-sky-800"
                    >
                      Marcar orado
                    </button>
                    <button
                      onClick={() => markStatus(request, "answered")}
                      className="min-h-11 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white"
                    >
                      Respondido
                    </button>
                  </div>
                )}
              </article>
            );
          })}

          {sortedRequests.length === 0 && (
            <div className="rounded-lg border border-white/80 bg-white/90 p-5 text-center shadow-sm lg:col-span-2">
              <Heart className="mx-auto text-slate-300" size={30} />
              <p className="mt-3 text-sm font-semibold text-slate-500">Nenhum pedido visivel para seu acesso.</p>
            </div>
          )}
        </section>
      </section>
    </AppShell>
  );
}
