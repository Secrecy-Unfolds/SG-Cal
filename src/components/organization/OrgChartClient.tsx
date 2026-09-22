"use client";

import type { OrgChartNode } from "@/lib/orgDisplay";

function Node({ node, depth }: { node: OrgChartNode; depth: number }) {
  return (
    <li>
      <div className="flex items-baseline gap-2 py-1">
        <span className="text-sm font-medium">{node.username}</span>
        {node.label && <span className="text-xs text-black/50 dark:text-white/50">{node.label}</span>}
        {node.department && !node.label.startsWith(node.department) && (
          <span className="text-xs text-black/30 dark:text-white/30">· {node.department}</span>
        )}
        {node.children.length > 0 && (
          <span className="text-[10px] text-black/30 dark:text-white/30">
            {node.children.length} direct report{node.children.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className={`ml-3 pl-4 border-l border-black/10 dark:border-white/10 ${depth > 8 ? "hidden" : ""}`}>
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

// The reporting chain as an indented tree — read-only, computed from the
// Departments / titles (lib/orgHierarchy.ts). People with no title and no
// department yet are listed separately.
export default function OrgChartClient({ roots, unplaced }: { roots: OrgChartNode[]; unplaced: OrgChartNode[] }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-black/50 dark:text-white/50">
        Everyone reports to the one person directly above them: an employee to their Team Lead (or, with no team, the
        Project Head, or, with no project, their department&rsquo;s Manager), a Team Lead to the Project Head, a Project
        Head to the Manager of the project&rsquo;s department, a Manager to the Director, a Director to their Chief
        Officer, and a Chief Officer to the CEO.</p>

      {roots.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          Nobody is placed in the structure yet. Give someone a department or a title on the HR page, or name a
          department&rsquo;s Manager.
        </p>
      ) : (
        <ul className="space-y-2">
          {roots.map((r) => (
            <Node key={r.id} node={r} depth={0} />
          ))}
        </ul>
      )}

      {unplaced.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40 mb-2">
            Not placed in the structure ({unplaced.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {unplaced.map((u) => (
              <span key={u.id} className="text-xs rounded-full px-2.5 py-1 bg-black/5 dark:bg-white/10">
                {u.username}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
