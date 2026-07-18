import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { CareTask, Person } from "@/lib/data";
import { PersonAvatar } from "@/components/person-avatar";
import { PriorityBadge } from "@/components/status-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";

const unknownPerson: Person = {
  id: "",
  name: "Pessoa nao encontrada",
  initials: "?",
  stage: "",
  status: "",
  phone: "",
  email: "",
  cell: "",
  leader: "",
  discipleshipLeader: "",
  neighborhood: "",
  firstVisit: "",
  birthday: "",
  progress: 0,
  cellAbsences: 0,
  servicePresent: false,
  tone: "bg-slate-100 text-slate-500",
  churchId: "",
  cellId: "",
  createdByUserId: "",
  leaderUserId: "",
};

export function CareTaskCard({
  task,
  person,
  completed = false,
  onComplete,
}: {
  task: CareTask;
  person?: Person;
  completed?: boolean;
  onComplete?: () => void;
}) {
  const displayPerson = person ?? unknownPerson;

  return (
    <article className={`rounded-lg border border-slate-100 bg-white/90 p-4 shadow-sm ${completed ? "opacity-65" : ""}`}>
      <div className="flex items-start gap-3">
        {person ? (
          <Link href={`/pessoas/${person.id}`} className="shrink-0">
            <PersonAvatar person={displayPerson} size="sm" />
          </Link>
        ) : (
          <PersonAvatar person={displayPerson} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <PriorityBadge priority={task.priority} />
            <span className="text-xs font-semibold text-slate-400">{task.due}</span>
          </div>
          {person && (
            <Link href={`/pessoas/${person.id}`} className="mt-2 block text-sm font-bold text-emerald-800 hover:underline">
              {person.name}
            </Link>
          )}
          <h3 className="mt-1 text-base font-semibold leading-tight text-slate-950">{task.title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">{task.description}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <WhatsAppButton phone={displayPerson.phone} message={task.message} />
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
