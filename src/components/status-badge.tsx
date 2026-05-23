import type { Priority } from "@/lib/data";

const priorityStyles: Record<Priority, string> = {
  Baixa: "bg-sky-100 text-sky-800",
  Media: "bg-amber-100 text-amber-900",
  Alta: "bg-rose-100 text-rose-800",
  Urgente: "bg-red-600 text-white",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded-lg px-2 py-1 text-xs font-bold ${priorityStyles[priority]}`}>
      {priority}
    </span>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600">{label}</span>;
}
