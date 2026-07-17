"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Church,
  Clock,
  HeartHandshake,
  Plus,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { getScopedCareTasks, getScopedCells, getScopedPastoralReminders, getScopedPeople } from "@/lib/access-control";
import { getNextMeetingDate } from "@/lib/cell-schedule";
import type { PastoralReminder } from "@/lib/data";
import { roleLabels } from "@/lib/data";
import {
  useCareTasks,
  useCells,
  useLocalPeople,
  usePastoralReminders,
  useSupervisorVisits,
} from "@/lib/local-store";
import { daysUntilBirthday } from "@/lib/notifications";

function toLocalInputDateTime(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isOverdue(value: string) {
  return new Date(value).getTime() < Date.now() && !isToday(value);
}

function toLocalDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function typeLabel(type: PastoralReminder["reminderType"]) {
  const labels: Record<PastoralReminder["reminderType"], string> = {
    visita: "Visita",
    discipulado: "Discipulado",
    ligacao: "Ligacao",
    reuniao: "Reuniao",
    oracao: "Oracao",
    outro: "Outro",
  };
  return labels[type];
}

export default function AgendaPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { tasks } = useCareTasks();
  const { visits } = useSupervisorVisits();
  const { reminders, addReminder, completeReminder } = usePastoralReminders();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleTasks = getScopedCareTasks(currentUser, tasks, people, isDemoMode);
  const visibleReminders = getScopedPastoralReminders(currentUser, reminders, cells, people, isDemoMode);
  const openReminders = visibleReminders.filter((reminder) => reminder.status === "open");
  const todayReminders = openReminders.filter((reminder) => isToday(reminder.dueAt));
  const overdueReminders = openReminders.filter((reminder) => isOverdue(reminder.dueAt));
  const nextCells = [...visibleCells]
    .sort((a, b) => getNextMeetingDate(a.meetingDay).localeCompare(getNextMeetingDate(b.meetingDay)))
    .slice(0, 3);
  const birthdays = visiblePeople
    .map((person) => ({ person, days: daysUntilBirthday(person.birthday) }))
    .filter((item): item is { person: (typeof visiblePeople)[number]; days: number } => item.days !== null)
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)
    .map((item) => item.person);
  const pendingSupervision = visibleCells.filter(
    (cell) => !visits.some((visit) => visit.cellId === cell.id && toLocalDateKey(visit.createdAt) === toLocalDateKey(new Date())),
  );
  const selectedPeople = visiblePeople.slice(0, 12);
  const selectedCells = visibleCells.slice(0, 12);

  const agendaItems = useMemo(
    () =>
      [
        ...openReminders.map((reminder) => ({
          id: reminder.id,
          kind: "reminder" as const,
          title: reminder.title,
          description: reminder.description,
          due: reminder.dueAt,
          personId: reminder.personId,
          cellId: reminder.cellId,
          reminder,
        })),
        ...visibleTasks.slice(0, 6).map((task) => ({
          id: task.id,
          kind: "care" as const,
          title: task.title,
          description: task.description,
          due: task.due,
          personId: task.personId,
          cellId: undefined,
        })),
      ].sort((a, b) => String(a.due).localeCompare(String(b.due))),
    [openReminders, visibleTasks],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const personId = String(formData.get("personId") || "");
    const cellId = String(formData.get("cellId") || "");
    const result = await addReminder({
      churchId: currentUser.churchId,
      assignedTo: currentUser.id,
      createdBy: currentUser.id,
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      reminderType: String(formData.get("reminderType") || "outro") as PastoralReminder["reminderType"],
      dueAt: new Date(String(formData.get("dueAt") || toLocalInputDateTime())).toISOString(),
      personId: personId || undefined,
      cellId: cellId || undefined,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      toast.error(`Nao consegui criar o lembrete: ${result.error}`);
      return;
    }

    toast.success("Lembrete criado na agenda.");
    setOpen(false);
    event.currentTarget.reset();
  }

  async function handleCompleteReminder(reminderId: string) {
    const result = await completeReminder(reminderId, !isDemoMode);

    if (!result.ok) {
      toast.error(`Nao consegui concluir o lembrete: ${result.error}`);
      return;
    }

    toast.success("Lembrete concluido.");
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow={roleLabels[currentUser.role]}
          title="Agenda pastoral"
          action={
            <button onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm" aria-label="Novo lembrete">
              <Plus size={18} />
            </button>
          }
        />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <Clock size={20} className="text-emerald-200" />
            <p className="mt-3 text-2xl font-semibold">{todayReminders.length}</p>
            <p className="text-sm text-slate-300">Hoje</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <Bell size={20} className="text-amber-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{overdueReminders.length}</p>
            <p className="text-sm text-slate-500">Atrasados</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <HeartHandshake size={20} className="text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{visibleTasks.length}</p>
            <p className="text-sm text-slate-500">Cuidados</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <Church size={20} className="text-sky-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{pendingSupervision.length}</p>
            <p className="text-sm text-slate-500">Celulas a observar</p>
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Prioridade" title="Hoje e proximos passos" />
            <div className="space-y-3">
              {agendaItems.map((item) => {
                const person = visiblePeople.find((candidate) => candidate.id === item.personId);
                const cell = visibleCells.find((candidate) => candidate.id === item.cellId);
                const overdue = item.kind === "reminder" && isOverdue(item.due);

                return (
                  <article key={`${item.kind}-${item.id}`} className="rounded-lg bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`rounded-lg px-2 py-1 text-xs font-bold ${overdue ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {item.kind === "reminder" ? typeLabel(item.reminder.reminderType) : "Cuidado"}
                        </span>
                        <p className="mt-3 font-bold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          {item.kind === "reminder" ? formatDateTime(item.due) : item.due}
                          {cell ? ` - ${cell.name}` : ""}
                        </p>
                      </div>
                      {item.kind === "reminder" && (
                        <button
                          onClick={() => handleCompleteReminder(item.id)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700"
                          aria-label="Concluir lembrete"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      )}
                    </div>
                    {person && (
                      <div className="mt-3">
                        <WhatsAppButton
                          phone={person.phone}
                          message={`Ola, ${person.name}! Passando para lembrar do nosso acompanhamento. Como voce esta?`}
                          label="WhatsApp"
                          className="w-full"
                        />
                      </div>
                    )}
                  </article>
                );
              })}
              {agendaItems.length === 0 && (
                <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhum lembrete pendente para seu acesso.</p>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Semana" title="Celulas e encontros" />
              <div className="space-y-3">
                {nextCells.map((cell) => (
                  <div key={cell.id} className="rounded-lg bg-slate-50 p-4">
                    <p className="font-bold text-slate-950">{cell.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{cell.meetingDay}, {cell.meetingTime} - {cell.neighborhood}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Pessoas" title="Aniversarios e cuidado" />
              <div className="space-y-3">
                {birthdays.map((person) => (
                  <div key={person.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-950">{person.name}</span>
                      <span className="text-sm text-slate-500">{person.birthday}</span>
                    </span>
                    <UserRound size={18} className="shrink-0 text-emerald-700" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        {open && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
            <form onSubmit={handleSubmit} className="animate-enter w-full rounded-[22px] bg-white p-5 shadow-2xl shadow-slate-900/20 sm:max-w-lg">
              <SectionHeader eyebrow="Agenda" title="Novo lembrete" />
              <div className="space-y-3">
                <input name="title" required placeholder="Titulo do lembrete" className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
                <textarea name="description" rows={3} placeholder="Descricao ou proximo passo" className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" />
                <div className="grid grid-cols-2 gap-3">
                  <select name="reminderType" className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                    <option value="ligacao">Ligacao</option>
                    <option value="visita">Visita</option>
                    <option value="discipulado">Discipulado</option>
                    <option value="reuniao">Reuniao</option>
                    <option value="oracao">Oracao</option>
                    <option value="outro">Outro</option>
                  </select>
                  <input name="dueAt" type="datetime-local" defaultValue={toLocalInputDateTime()} className="min-h-12 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
                </div>
                <select name="personId" className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  <option value="">Sem pessoa vinculada</option>
                  {selectedPeople.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
                <select name="cellId" className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  <option value="">Sem celula vinculada</option>
                  {selectedCells.map((cell) => (
                    <option key={cell.id} value={cell.id}>{cell.name}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-700">
                  Cancelar
                </button>
                <button className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
                  <CalendarCheck size={18} />
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </AppShell>
  );
}
