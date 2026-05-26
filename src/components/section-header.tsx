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
        <span className="text-[11px] font-black uppercase text-emerald-700 sm:text-xs">{eyebrow}</span>
        <h2 className="mt-1 text-[22px] font-semibold leading-[1.08] text-slate-950 sm:text-2xl">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
