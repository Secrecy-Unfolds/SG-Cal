import type { LucideIcon } from "lucide-react";
import { HudFrame } from "./HudFrame";

export default function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
}) {
  return (
    <HudFrame
      corners="tl-br"
      className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 flex items-center gap-3"
    >
      <div className="w-9 h-9 rounded-lg bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-accent dark:text-blue-300 shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-tight truncate">{value}</div>
        <div className="text-xs text-black/50 dark:text-white/50 truncate">{label}</div>
      </div>
    </HudFrame>
  );
}
