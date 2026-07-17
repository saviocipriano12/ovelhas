import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-white/80 bg-white/90 p-5 text-center shadow-sm ${className ?? ""}`}>
      <Icon className="mx-auto text-slate-300" size={30} />
      <p className="mt-3 text-sm font-semibold text-slate-500">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  );
}
