"use client";

import { useState } from "react";
import { HudFrame } from "@/components/hud/HudFrame";
import { PaginationControls, usePagination } from "@/components/Pagination";
import EmployeeDocumentsPanel from "@/components/hr/EmployeeDocumentsPanel";
import type { EmployeeDetails } from "@/lib/hr";
import { formatDateOnly } from "@/lib/procurementDisplay";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

function TeamMemberRow({ member }: { member: EmployeeDetails }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<EmployeeDetails | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!expanded && !detail) {
      setLoading(true);
      try {
        const res = await fetch(`/api/hr/employees/${member.user_id}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setDetail(data.employee);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  }

  const title = member.job_title
    ? member.job_title_qualified && member.department
      ? `${member.department} ${member.job_title}`
      : member.job_title
    : null;

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 p-3">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between gap-2 text-left">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{member.name || member.username}</div>
          <div className="text-xs text-black/50 dark:text-white/50 truncate">
            {[title, member.position].filter(Boolean).join(" · ") || "No title/position set"}
          </div>
        </div>
        <span className="text-xs text-accent dark:text-blue-300 shrink-0">
          {loading ? "Loading…" : expanded ? "Hide" : "Details"}
        </span>
      </button>

      {expanded && detail && (
        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10 grid grid-cols-2 gap-3 text-sm">
          <DetailRow label="Department" value={detail.department} />
          <DetailRow label="Join date" value={formatDateOnly(detail.join_date)} />
          <DetailRow label="Civil ID" value={detail.civil_id} />
          <DetailRow label="Civil ID expiry" value={formatDateOnly(detail.civil_id_expiry)} />
          <DetailRow label="Passport" value={detail.passport_number} />
          <DetailRow label="Passport expiry" value={formatDateOnly(detail.passport_expiry)} />
          {detail.country && detail.country.trim().toLowerCase() !== "oman" && (
            <DetailRow label="Visa expiry" value={formatDateOnly(detail.visa_expiry)} />
          )}
          <DetailRow label="Contract expiry" value={formatDateOnly(detail.contract_expiry)} />
          <DetailRow label="Date of birth" value={formatDateOnly(detail.date_of_birth)} />
          <DetailRow label="Gender" value={detail.gender} />
          <DetailRow label="Father's name" value={detail.father_name} />
          <DetailRow label="Religion" value={detail.religion} />
          <DetailRow label="Country" value={detail.country} />
          <DetailRow
            label="Education"
            value={[detail.education_level, detail.degree_field].filter(Boolean).join(" — ")}
          />
          <DetailRow
            label="Emergency contact"
            value={[detail.emergency_contact_name, detail.emergency_contact_phone].filter(Boolean).join(" · ")}
          />
          <div className="col-span-2">
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide mb-1">Documents</div>
            <EmployeeDocumentsPanel userId={member.user_id} canManage={false} />
          </div>
        </div>
      )}
    </div>
  );
}

// Shown only to someone with at least one subordinate in the reporting
// chain (a Department's Manager/Director, a Project Head, or a Team Lead —
// confirmed 2026-09-22: "anyone can see the sensitive details of employees
// strictly below them"). Everyone else gets no card at all — most employees
// have no one below them. `members` is the already-redacted basic list from
// the server (lib/hr.ts's listSubordinatesWithDetails); the sensitive
// fields only load on demand, per person, via GET
// /api/hr/employees/[userId] — the same route Admin-level and self use,
// authorized here because the viewer is a strict superior.
export default function MyTeamCard({ members }: { members: EmployeeDetails[] }) {
  const { pageItems, page, setPage, totalPages } = usePagination(members);

  return (
    <HudFrame corners="all" className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-3">
      <h2 className="font-heading font-semibold text-sm uppercase tracking-wide">My Team</h2>
      <p className="text-xs text-black/50 dark:text-white/50">
        Everyone who reports up to you, directly or through someone else. Salary and leave balance stay Admin-level
        only.
      </p>
      <div className="space-y-2">
        {pageItems.map((m) => (
          <TeamMemberRow key={m.user_id} member={m} />
        ))}
      </div>
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
    </HudFrame>
  );
}
