import type { LucideIcon } from "lucide-react";

export function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <article className="animate-enter rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/80 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <strong className="mt-2 block text-3xl font-semibold text-slate-950">{value}</strong>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/80 bg-white text-emerald-900 shadow-sm">
          <Icon size={19} strokeWidth={2.3} />
        </span>
      </div>
      <div className={`mt-4 h-1.5 rounded-full ${accent}`} />
    </article>
  );
}
