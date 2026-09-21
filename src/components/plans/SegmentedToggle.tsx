"use client";

// Small pill-style segmented control — the same look the List/Graph toggle
// on a plan's detail page already used, factored out so the graph-depth
// pickers (Milestones / + Stages / + Steps) reuse it.
export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`btn-skew px-3 py-1 font-medium transition-colors ${
            value === opt.value ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
