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
    <article className="animate-enter rounded-[18px] border border-white/80 bg-white/90 p-3 shadow-sm shadow-slate-200/80 backdrop-blur sm:rounded-lg sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
          <strong className="mt-2 block text-2xl font-semibold text-slate-950 sm:text-3xl">{value}</strong>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white text-emerald-900 shadow-sm sm:h-10 sm:w-10 sm:rounded-lg">
          <Icon size={18} strokeWidth={2.3} />
        </span>
      </div>
      <div className={`mt-4 h-1.5 rounded-full ${accent}`} />
    </article>
  );
}
