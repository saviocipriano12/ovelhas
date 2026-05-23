export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="animate-progress h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
