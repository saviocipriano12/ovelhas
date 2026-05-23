import { CheckCircle2 } from "lucide-react";
import type { CareTask } from "@/lib/data";
import { getTaskPerson } from "@/lib/data";
import { PersonAvatar } from "@/components/person-avatar";
import { PriorityBadge } from "@/components/status-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";

export function CareTaskCard({
  task,
  completed = false,
  onComplete,
}: {
  task: CareTask;
  completed?: boolean;
  onComplete?: () => void;
}) {
  const person = getTaskPerson(task);

  return (
    <article className={`rounded-lg border border-slate-100 bg-white/90 p-4 shadow-sm ${completed ? "opacity-65" : ""}`}>
      <div className="flex items-start gap-3">
        <PersonAvatar person={person} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <PriorityBadge priority={task.priority} />
            <span className="text-xs font-semibold text-slate-400">{task.due}</span>
          </div>
          <h3 className="mt-3 text-base font-semibold leading-tight text-slate-950">{task.title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">{task.description}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <WhatsAppButton phone={person.phone} message={task.message} />
        <button
          onClick={onComplete}
          className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-3 ${
            completed
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
          }`}
          aria-label={completed ? "Reabrir cuidado" : "Concluir cuidado"}
        >
          <CheckCircle2 size={18} />
        </button>
      </div>
    </article>
  );
}
