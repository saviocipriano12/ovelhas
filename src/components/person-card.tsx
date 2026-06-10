import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { Person } from "@/lib/data";
import { ProgressBar } from "@/components/progress-bar";
import { PersonAvatar } from "@/components/person-avatar";
import { StatusBadge } from "@/components/status-badge";

export function PersonCard({ person, action }: { person: Person; action?: ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-100 bg-white/90 p-4 shadow-sm hover:-translate-y-0.5 hover:border-emerald-200">
      <Link href={`/pessoas/${person.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PersonAvatar person={person} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-950">{person.name}</p>
              <p className="truncate text-sm text-slate-500">{person.stage}</p>
            </div>
          </div>
          <ChevronRight size={18} className="mt-3 shrink-0 text-slate-400" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <StatusBadge label={person.status} />
          <span className="text-xs font-bold text-emerald-700">{person.progress}%</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={person.progress} />
        </div>
      </Link>
      {action ? <div className="mt-3">{action}</div> : null}
    </article>
  );
}
