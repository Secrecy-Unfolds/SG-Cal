// Presentational only — every caller computes the percentage server-side
// via lib/planProgress.ts and passes it down, keeping the "compute live"
// logic in one place (see docs/erp-v3-roadmap.md).
export default function PlanProgressBar({
  progress,
  total,
  done,
  unit = "steps",
  className = "",
}: {
  progress: number;
  total: number;
  done: number;
  // "steps" for a flat plan/Stage; "stages"/"milestones" for a
  // Milestone's/Strategy's rollup, where `total`/`done` count children at
  // 100%, not raw steps (see lib/planProgress.ts).
  unit?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs text-black/50 dark:text-white/50 mb-1">
        <span>
          {done}/{total} {unit} done
        </span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}
