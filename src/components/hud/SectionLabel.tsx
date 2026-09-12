import type { ReactNode } from "react";

export default function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-accent ${className}`}>
      {"// "}
      {children}
    </p>
  );
}
