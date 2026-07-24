"use client";

import Link from "next/link";
import {
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Church,
  ClipboardList,
  Heart,
  HeartHandshake,
  PlayCircle,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { useCareTasks, useLocalPeople } from "@/lib/local-store";
import type { PastoralNotification } from "@/lib/notifications";
import { usePastoralNotifications } from "@/lib/use-pastoral-notifications";

const typeIcons: Record<PastoralNotification["type"], LucideIcon> = {
  care: HeartHandshake,
  absence: UserRound,
  birthday: CalendarDays,
  video: PlayCircle,
  report: ClipboardList,
  supervision: Church,
  agenda: Bell,
  structure: ShieldAlert,
  prayer: Heart,
  notice: BellRing,
};

function priorityTone(priority: PastoralNotification["priority"]) {
  if (priority === "Urgente") {
    return "bg-rose-100 text-rose-800";
  }

  if (priority === "Alta") {
    return "bg-amber-100 text-amber-900";
  }

  if (priority === "Media") {
    return "bg-sky-100 text-sky-800";
  }

  return "bg-emerald-100 text-emerald-800";
}

const QUEUE_LIMIT = 6;

export function DailyActionQueue() {
  const { isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { tasks, completeCareTask } = useCareTasks();
  const { unread, markRead } = usePastoralNotifications();
  const toast = useToast();

  const queue = unread.slice(0, QUEUE_LIMIT);

  async function handleCompleteCare(notification: PastoralNotification) {
    const taskId = notification.id.replace("care-", "");
    const result = await completeCareTask(taskId, !isDemoMode);

    if (!result.ok) {
      toast.error(`Nao consegui concluir: ${result.error}`);
      return;
    }

    markRead(notification.id);
    toast.success("Cuidado concluido.");
  }

  return (
    <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
      <SectionHeader
        eyebrow="Prioridade de hoje"
        title="Fila de acao"
        action={
          <Link href="/notificacoes" className="text-xs font-bold text-emerald-800 hover:underline">
            Ver tudo ({unread.length})
          </Link>
        }
      />

      {queue.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-500">
          Nada urgente agora. Bom trabalho.
        </p>
      ) : (
        <div className="space-y-3">
          {queue.map((notification) => {
            const Icon = typeIcons[notification.type];
            const person = notification.personId
              ? people.find((item) => item.id === notification.personId)
              : undefined;
            const isCareTask =
              notification.type === "care" && tasks.some((task) => `care-${task.id}` === notification.id);
            const firstName = person?.name.split(" ")[0];

            return (
              <article key={notification.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-800 shadow-sm">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${priorityTone(notification.priority)}`}>
                      {notification.priority}
                    </span>
                    <p className="mt-1.5 truncate text-sm font-bold text-slate-950">{notification.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-500">{notification.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {person?.phone ? (
                    <WhatsAppButton
                      className="flex-1"
                      phone={person.phone}
                      message={`Ola, ${firstName}! Passando para saber como voce esta.`}
                    />
                  ) : (
                    <Link
                      href={notification.href}
                      onClick={() => markRead(notification.id)}
                      className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white"
                    >
                      Abrir
                    </Link>
                  )}
                  {isCareTask && (
                    <button
                      onClick={() => handleCompleteCare(notification)}
                      className="flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-emerald-800"
                      aria-label="Concluir cuidado"
                      title="Concluir cuidado"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => markRead(notification.id)}
                    className="flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-500"
                    aria-label="Dispensar"
                    title="Dispensar"
                  >
                    <X size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
