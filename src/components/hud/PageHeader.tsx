import type { ReactNode } from "react";
import SectionLabel from "./SectionLabel";

export default function PageHeader({
  label,
  title,
  children,
  className = "",
}: {
  label: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 mb-4 ${className}`}>
      <div className="min-w-0">
        <SectionLabel>{label}</SectionLabel>
        <h1 className="text-xl font-semibold uppercase tracking-wide truncate">{title}</h1>
      </div>
      {children}
    </div>
  );
}
