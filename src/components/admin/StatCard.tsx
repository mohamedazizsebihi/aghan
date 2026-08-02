export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-900/10 text-green-800">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink/45">
          {label}
        </p>
        <p className="mt-0.5 font-display text-2xl font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}
