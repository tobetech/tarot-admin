export function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string; // สีตัวเลขหลัก เช่น "#eed587"
}) {
  return (
    <div className="rounded-2xl border border-[#23262e] bg-[#181a20] p-6">
      <div className="text-sm text-slate-400">{label}</div>
      <div
        className="mt-3 text-4xl font-bold tracking-tight"
        style={{ color }}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-sm text-slate-500">{sub}</div>}
    </div>
  );
}
