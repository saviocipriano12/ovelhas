import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-xs font-bold uppercase text-emerald-700">{eyebrow}</span>
        <h2 className="mt-1 text-xl font-semibold leading-tight text-slate-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}
