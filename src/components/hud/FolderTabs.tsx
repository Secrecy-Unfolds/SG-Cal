"use client";

export default function FolderTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex items-end border-b-2 border-black/10 dark:border-white/10 mb-4">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`px-6 pt-2 font-mono text-xs font-semibold uppercase tracking-wide transition-all ${
              isActive
                ? "relative z-10 -mb-[2px] bg-accent text-ink pb-[calc(0.5rem+2px)]"
                : "translate-y-[3px] bg-black/5 dark:bg-white/5 text-black/50 dark:text-white/50 pb-2"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
