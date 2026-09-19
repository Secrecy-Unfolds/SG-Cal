"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { StepRow } from "@/lib/planSteps";
import { STEP_STATUS_BADGE_CLASS, STEP_STATUS_LABELS } from "@/lib/planDisplay";
import { formatMuscatDateTime } from "@/lib/time";

const COL_WIDTH = 260;
const ROW_HEIGHT = 130;
const EDGE_COLOR = "#94a3b8"; // slate-400 — reads fine on both light and dark canvases

type StepNodeData = { step: StepRow; readOnly: boolean; onSelect: (step: StepRow) => void };
type StepFlowNode = Node<StepNodeData, "step">;

function StepNode({ data }: NodeProps<StepFlowNode>) {
  const { step, readOnly, onSelect } = data;
  const due = step.step_type === "task" && step.end_at ? step.end_at : step.start_at;
  return (
    <button
      type="button"
      onClick={() => !readOnly && onSelect(step)}
      className={`w-56 text-left rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-3 shadow-sm ${
        readOnly ? "cursor-default" : "hover:border-accent/40 cursor-pointer"
      }`}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide font-medium text-black/40 dark:text-white/40">
          {step.step_type === "task" ? "Task" : "Meeting"}
        </span>
        <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${STEP_STATUS_BADGE_CLASS[step.status]}`}>
          {STEP_STATUS_LABELS[step.status]}
        </span>
      </div>
      <div className="text-sm font-medium truncate mt-1">{step.title}</div>
      <div className="text-xs text-black/50 dark:text-white/50 mt-1 truncate">
        {formatMuscatDateTime(new Date(due))}
        {step.assignee_username ? ` · ${step.assignee_username}` : " · Unassigned"}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </button>
  );
}

const NODE_TYPES = { step: StepNode };

export default function StepWorkflowGraph({
  steps,
  readOnly,
  onSelectStep,
}: {
  steps: StepRow[];
  readOnly: boolean;
  onSelectStep: (step: StepRow) => void;
}) {
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setColorMode(root.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // A step's own column is its prerequisite depth (longest chain of
  // prerequisites behind it) — steps with no prerequisites start at
  // column 0, everything else sits one column past its slowest
  // prerequisite. This reads the graph left-to-right in dependency order
  // without needing a general-purpose auto-layout library:
  // lib/planSteps.ts's setStepPrerequisites already rejects cycles
  // server-side, so the recursion below always terminates.
  const { nodes, edges } = useMemo(() => {
    const stepById = new Map(steps.map((s) => [s.id, s]));
    const depthCache = new Map<number, number>();

    function depthOf(stepId: number, visiting: Set<number>): number {
      const cached = depthCache.get(stepId);
      if (cached !== undefined) return cached;
      if (visiting.has(stepId)) return 0; // defensive only — cycles are rejected server-side
      visiting.add(stepId);
      const step = stepById.get(stepId);
      const prereqIds = step?.prerequisite_step_ids.filter((id) => stepById.has(id)) ?? [];
      const depth = prereqIds.length === 0 ? 0 : 1 + Math.max(...prereqIds.map((id) => depthOf(id, visiting)));
      depthCache.set(stepId, depth);
      return depth;
    }

    const byDepth = new Map<number, StepRow[]>();
    for (const step of steps) {
      const depth = depthOf(step.id, new Set());
      const list = byDepth.get(depth) ?? [];
      list.push(step);
      byDepth.set(depth, list);
    }

    const flowNodes: StepFlowNode[] = [];
    for (const [depth, stepsAtDepth] of byDepth) {
      stepsAtDepth
        .sort((a, b) => a.sort_order - b.sort_order)
        .forEach((step, i) => {
          flowNodes.push({
            id: String(step.id),
            type: "step",
            position: { x: depth * COL_WIDTH, y: i * ROW_HEIGHT },
            data: { step, readOnly, onSelect: onSelectStep },
          });
        });
    }

    const flowEdges: Edge[] = [];
    for (const step of steps) {
      for (const prereqId of step.prerequisite_step_ids) {
        if (!stepById.has(prereqId)) continue;
        flowEdges.push({
          id: `${prereqId}-${step.id}`,
          source: String(prereqId),
          target: String(step.id),
          markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
          style: { stroke: EDGE_COLOR },
        });
      }
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [steps, readOnly, onSelectStep]);

  return (
    <div className="h-[520px] rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={colorMode}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color={colorMode === "dark" ? "#27272a" : "#e5e7eb"} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
