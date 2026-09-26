type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive"; //"positive" shows the value in green
};

export default function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${
          tone === "positive" ? "text-accent" : ""}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}