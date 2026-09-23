export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "amber",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent?: "amber" | "emerald" | "sky" | "violet";
}) {
  const accentClasses: Record<string, string> = {
    amber: "bg-amber-500/10 text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    sky: "bg-sky-500/10 text-sky-400",
    violet: "bg-violet-500/10 text-violet-400",
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${accentClasses[accent]}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
