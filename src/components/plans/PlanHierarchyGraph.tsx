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
import {
  HEADER,
  MIN_FRAME_W,
  PAD,
  layoutLevel,
  type GraphFrame,
  type Laid,
  type TreeNode,
} from "@/lib/planGraph";

const EDGE_COLOR = "#94a3b8"; // slate-400 — reads fine on both light and dark canvases

type FlowData = {
  node?: TreeNode;
  frame?: GraphFrame;
  onSelect?: (node: TreeNode) => void;
};
type FlowNode = Node<FlowData>;

// Per-kind accent for dashed containers / progress bars — milestone
// violet, stage sky, so which level a dashed box belongs to reads at a
// glance even when several are nested.
const KIND_CONTAINER_CLASS: Record<TreeNode["kind"], string> = {
  milestone: "border-violet-400/70 dark:border-violet-400/50 bg-violet-500/[0.04]",
  stage: "border-sky-400/70 dark:border-sky-400/50 bg-sky-500/[0.04]",
  step: "border-black/20 dark:border-white/20",
};
const KIND_TEXT_CLASS: Record<TreeNode["kind"], string> = {
  milestone: "text-violet-700 dark:text-violet-300",
  stage: "text-sky-700 dark:text-sky-300",
  step: "text-black/50 dark:text-white/50",
};

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-[10px] text-black/50 dark:text-white/50 tabular-nums">{progress}%</span>
    </div>
  );
}

// A collapsed node: a plain card. Steps, and a Milestone/Stage that isn't
// expanded at the currently-selected depth.
function CardNode({ data }: NodeProps<FlowNode>) {
  const { node, onSelect } = data;
  if (!node) return null;
  const clickable = !!onSelect && (!!node.href || node.stepId !== undefined);
  return (
    <button
      type="button"
      onClick={() => clickable && onSelect(node)}
      className={`pointer-events-auto w-full h-full text-left rounded-xl border bg-white dark:bg-neutral-900 p-2.5 shadow-sm overflow-hidden ${
        node.kind === "step"
          ? "border-black/10 dark:border-white/10"
          : node.kind === "milestone"
          ? "border-violet-400/60 dark:border-violet-400/40"
          : "border-sky-400/60 dark:border-sky-400/40"
      } ${clickable ? "hover:border-accent/60 cursor-pointer" : "cursor-default"}`}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] uppercase tracking-wide font-medium ${KIND_TEXT_CLASS[node.kind]}`}>
          {node.typeLabel}
        </span>
        {node.badge && (
          <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${node.badge.className}`}>
            {node.badge.label}
          </span>
        )}
      </div>
      <div className="text-sm font-medium truncate mt-1">{node.title}</div>
      {node.subtitle && <div className="text-xs text-black/50 dark:text-white/50 truncate">{node.subtitle}</div>}
      {node.meta && <div className="text-xs text-black/50 dark:text-white/50 truncate">{node.meta}</div>}
      {node.progress !== undefined && <ProgressBar progress={node.progress} />}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </button>
  );
}

// An expanded Milestone/Stage: a dashed rounded rectangle drawn around its
// own children, so the higher-level item stays visible (and clickable via
// its header) while looking at what's inside it.
function ContainerNode({ data }: NodeProps<FlowNode>) {
  const { node, onSelect } = data;
  if (!node) return null;
  const clickable = !!onSelect && !!node.href;
  return (
    <div className={`w-full h-full rounded-2xl border-2 border-dashed ${KIND_CONTAINER_CLASS[node.kind]}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, top: HEADER / 2 }} />
      <button
        type="button"
        onClick={() => clickable && onSelect(node)}
        className={`pointer-events-auto flex items-center gap-2 w-full text-left px-3 ${
          clickable ? "cursor-pointer hover:underline" : "cursor-default"
        }`}
        style={{ height: HEADER }}
      >
        <span className={`text-[10px] uppercase tracking-wide font-semibold ${KIND_TEXT_CLASS[node.kind]}`}>
          {node.typeLabel}
        </span>
        <span className="text-sm font-medium truncate">{node.title}</span>
        {node.progress !== undefined && (
          <span className="ml-auto text-[10px] text-black/50 dark:text-white/50 tabular-nums">{node.progress}%</span>
        )}
      </button>
      {node.children && node.children.length === 0 && (
        <div className="px-3 text-xs text-black/40 dark:text-white/40">
          {node.kind === "milestone" ? "No stages yet" : "No steps yet"}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0, top: HEADER / 2 }} />
    </div>
  );
}

// The outer context frames — the Strategy/Milestone/Stage the whole graph
// sits inside. Not clickable; they exist so the higher structure is always
// visible around whatever level is being looked at.
function FrameNode({ data }: NodeProps<FlowNode>) {
  const { frame } = data;
  if (!frame) return null;
  return (
    <div className="w-full h-full rounded-2xl border-2 border-dashed border-black/25 dark:border-white/25">
      <div className="flex items-center gap-2 px-3" style={{ height: HEADER }}>
        <span className="text-[10px] uppercase tracking-wide font-semibold text-black/40 dark:text-white/40">
          {frame.kindLabel}
        </span>
        <span className="text-sm font-medium truncate text-black/70 dark:text-white/70">{frame.name}</span>
      </div>
    </div>
  );
}

const NODE_TYPES = { card: CardNode, container: ContainerNode, frame: FrameNode };

export default function PlanHierarchyGraph({
  nodes: treeNodes,
  frames = [],
  onSelectNode,
  emptyMessage = "Nothing to show yet.",
}: {
  nodes: TreeNode[];
  frames?: GraphFrame[];
  onSelectNode: (node: TreeNode) => void;
  emptyMessage?: string;
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

  const { nodes, edges, signature } = useMemo(() => {
    const layout = layoutLevel(treeNodes);
    const flowNodes: FlowNode[] = [];
    const flowEdges: Edge[] = [];

    // Frames, outermost first. Sizes are built from the innermost outward
    // (each frame wraps the next one in, plus padding and a header).
    const frameBoxes: { w: number; h: number }[] = new Array(frames.length);
    let w = layout.width;
    let h = layout.height;
    for (let i = frames.length - 1; i >= 0; i--) {
      w = Math.max(MIN_FRAME_W, w + 2 * PAD);
      h = h + HEADER + PAD;
      frameBoxes[i] = { w, h };
    }
    frames.forEach((frame, i) => {
      flowNodes.push({
        id: `frame-${i}`,
        type: "frame",
        parentId: i > 0 ? `frame-${i - 1}` : undefined,
        position: i === 0 ? { x: 0, y: 0 } : { x: PAD, y: HEADER },
        style: { width: frameBoxes[i].w, height: frameBoxes[i].h },
        data: { frame },
        draggable: false,
        selectable: false,
      });
    });

    function emit(items: Laid[], parentId: string | undefined, dx: number, dy: number) {
      const siblingKeys = new Set(items.map((it) => it.node.key));
      for (const it of items) {
        const isContainer = it.inner !== undefined;
        flowNodes.push({
          id: it.node.key,
          type: isContainer ? "container" : "card",
          parentId,
          position: { x: it.x + dx, y: it.y + dy },
          style: { width: it.w, height: it.h },
          data: { node: it.node, onSelect: onSelectNode },
          draggable: false,
          selectable: false,
        });
        for (const prereqKey of it.node.prerequisiteKeys) {
          if (!siblingKeys.has(prereqKey)) continue;
          flowEdges.push({
            id: `${prereqKey}->${it.node.key}`,
            source: prereqKey,
            target: it.node.key,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
            style: { stroke: EDGE_COLOR, strokeWidth: it.node.kind === "step" ? 1.5 : 2 },
          });
        }
        if (it.inner) emit(it.inner, it.node.key, PAD, HEADER);
      }
    }

    const innermost = frames.length > 0 ? `frame-${frames.length - 1}` : undefined;
    emit(layout.items, innermost, innermost ? PAD : 0, innermost ? HEADER : 0);

    return { nodes: flowNodes, edges: flowEdges, signature: flowNodes.map((n) => n.id).join("|") };
  }, [treeNodes, frames, onSelectNode]);

  if (treeNodes.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="h-[70vh] min-h-[420px] rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden">
        <ReactFlow
          // Remount when the set of drawn nodes changes (depth toggled) so
          // fitView re-frames the new layout instead of keeping the old viewport.
          key={signature}
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          colorMode={colorMode}
          fitView
          minZoom={0.15}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} color={colorMode === "dark" ? "#27272a" : "#e5e7eb"} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="text-xs text-black/40 dark:text-white/40 mt-2">
        Dashed boxes show the Strategy / Milestone / Stage each item sits inside. Arrows point from a prerequisite to
        what waits on it. Click a card or a box header to open it.
      </p>
    </div>
  );
}
