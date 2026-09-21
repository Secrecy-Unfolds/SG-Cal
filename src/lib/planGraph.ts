import { STEP_STATUS_BADGE_CLASS, STEP_STATUS_LABELS, type StepStatus } from "@/lib/planDisplay";
import { formatMuscatDateTime } from "@/lib/time";

// Client-safe (no `pg`) data shapes + pure layout for the plan graphs
// (Strategy -> Milestone -> Stage -> step). The server builds the Graph*
// shapes (lib/planGraphData.ts); the browser turns them into a TreeNode
// tree for whichever depth is selected, lays it out, and renders it
// (components/plans/PlanHierarchyGraph.tsx).

export type GraphStep = {
  id: number;
  title: string;
  step_type: "task" | "meeting";
  status: StepStatus;
  sort_order: number;
  due_at: string; // ISO — a task's due time, a meeting's start
  assignee_username: string | null;
  attendee_count: number;
  prerequisite_step_ids: number[];
};

export type GraphStage = {
  id: number;
  name: string;
  start_date: string | null;
  progress: number;
  prerequisite_stage_id: number | null;
  steps: GraphStep[];
};

export type GraphMilestone = {
  id: number;
  name: string;
  start_date: string | null;
  progress: number;
  prerequisite_milestone_id: number | null;
  stages: GraphStage[];
};

export type StrategyGraphDepth = "milestones" | "stages" | "steps";
export type MilestoneGraphDepth = "stages" | "steps";

// A node in the drawn graph. `children` present (even if empty) means the
// node is drawn EXPANDED — as a dashed container around its own children —
// so the higher structure stays visible while looking at the deeper level.
// Absent means a plain collapsed card.
export type TreeNode = {
  key: string;
  kind: "milestone" | "stage" | "step";
  title: string;
  typeLabel: string;
  subtitle?: string;
  meta?: string;
  badge?: { label: string; className: string };
  progress?: number; // 0-100, milestone/stage only
  prerequisiteKeys: string[]; // keys of SIBLINGS this node waits on
  children?: TreeNode[];
  href?: string;
  stepId?: number;
};

// An outer context frame (the Strategy/Milestone/Stage the whole graph
// sits inside), outermost first.
export type GraphFrame = { kindLabel: string; name: string };

function formatStartDate(startDate: string | null): string | undefined {
  return startDate ? `Starts ${startDate}` : undefined;
}

// Maps a full StepRow (Plan/Stage detail page) to the lightweight graph
// shape — structural param type so this file stays free of server imports.
export function graphStepFromRow(step: {
  id: number;
  title: string;
  step_type: "task" | "meeting";
  status: StepStatus;
  sort_order: number;
  start_at: Date | string;
  end_at: Date | string | null;
  assignee_username: string | null;
  attendees: unknown[];
  prerequisite_step_ids: number[];
}): GraphStep {
  const due = step.step_type === "task" && step.end_at ? step.end_at : step.start_at;
  return {
    id: step.id,
    title: step.title,
    step_type: step.step_type,
    status: step.status,
    sort_order: step.sort_order,
    due_at: new Date(due).toISOString(),
    assignee_username: step.assignee_username,
    attendee_count: step.attendees.length,
    prerequisite_step_ids: step.prerequisite_step_ids,
  };
}

export function stepTreeNode(step: GraphStep, href?: string): TreeNode {
  return {
    key: `t-${step.id}`,
    kind: "step",
    title: step.title,
    typeLabel: step.step_type === "task" ? "Task" : "Meeting",
    subtitle: formatMuscatDateTime(new Date(step.due_at)),
    meta:
      step.step_type === "task"
        ? step.assignee_username ?? "Unassigned"
        : step.attendee_count > 0
        ? `${step.attendee_count} attendee${step.attendee_count === 1 ? "" : "s"}`
        : "No attendees",
    badge: { label: STEP_STATUS_LABELS[step.status], className: STEP_STATUS_BADGE_CLASS[step.status] },
    prerequisiteKeys: step.prerequisite_step_ids.map((id) => `t-${id}`),
    href,
    stepId: step.id,
  };
}

export function stageTreeNode(stage: GraphStage, showSteps: boolean): TreeNode {
  const href = `/plans/${stage.id}`;
  return {
    key: `g-${stage.id}`,
    kind: "stage",
    title: stage.name,
    typeLabel: "Stage",
    subtitle: formatStartDate(stage.start_date),
    progress: stage.progress,
    prerequisiteKeys: stage.prerequisite_stage_id !== null ? [`g-${stage.prerequisite_stage_id}`] : [],
    children: showSteps ? stage.steps.map((s) => stepTreeNode(s, href)) : undefined,
    href,
  };
}

export function milestoneTreeNode(m: GraphMilestone, strategyId: number, depth: StrategyGraphDepth): TreeNode {
  return {
    key: `m-${m.id}`,
    kind: "milestone",
    title: m.name,
    typeLabel: "Milestone",
    subtitle: formatStartDate(m.start_date),
    progress: m.progress,
    prerequisiteKeys: m.prerequisite_milestone_id !== null ? [`m-${m.prerequisite_milestone_id}`] : [],
    children: depth === "milestones" ? undefined : m.stages.map((s) => stageTreeNode(s, depth === "steps")),
    href: `/plans/${strategyId}/milestones/${m.id}`,
  };
}

// ---- layout ---------------------------------------------------------

export const LEAF_W = 232;
export const LEAF_H = 104;
export const GAP_X = 64;
export const GAP_Y = 28;
export const PAD = 24;
export const HEADER = 36;
export const EMPTY_W = 232;
export const EMPTY_H = 60;
export const MIN_FRAME_W = 280;

export type Laid = {
  node: TreeNode;
  x: number; // relative to the enclosing content box's origin
  y: number;
  w: number;
  h: number;
  inner?: Laid[]; // present for an expanded (container) node
};

export type LevelLayout = { items: Laid[]; width: number; height: number };

// Lays out one set of siblings. A node's column is its prerequisite depth
// among its siblings (longest chain behind it), so the graph reads
// left-to-right in dependency order. Expanded nodes are sized from their
// own recursively laid-out children, so containers always fit their
// contents. Prerequisites are cycle-checked server-side; the visiting-set
// guard below is defensive only.
export function layoutLevel(nodes: TreeNode[]): LevelLayout {
  const sized = nodes.map((node) => {
    if (node.children === undefined) return { node, w: LEAF_W, h: LEAF_H, inner: undefined as Laid[] | undefined };
    if (node.children.length === 0) {
      return { node, w: EMPTY_W + 2 * PAD, h: HEADER + EMPTY_H + PAD, inner: [] as Laid[] };
    }
    const inner = layoutLevel(node.children);
    return {
      node,
      w: Math.max(LEAF_W, inner.width + 2 * PAD),
      h: HEADER + inner.height + PAD,
      inner: inner.items,
    };
  });

  const indexByKey = new Map(nodes.map((n, i) => [n.key, i]));
  const depthCache = new Map<number, number>();
  function depthOf(i: number, visiting: Set<number>): number {
    const cached = depthCache.get(i);
    if (cached !== undefined) return cached;
    if (visiting.has(i)) return 0;
    visiting.add(i);
    const prereqIdx = nodes[i].prerequisiteKeys.map((k) => indexByKey.get(k)).filter((v): v is number => v !== undefined);
    const depth = prereqIdx.length === 0 ? 0 : 1 + Math.max(...prereqIdx.map((p) => depthOf(p, visiting)));
    depthCache.set(i, depth);
    return depth;
  }

  const columns = new Map<number, number[]>();
  nodes.forEach((_, i) => {
    const d = depthOf(i, new Set());
    const list = columns.get(d) ?? [];
    list.push(i);
    columns.set(d, list);
  });

  const items: Laid[] = new Array(nodes.length);
  let x = 0;
  let height = 0;
  const sortedDepths = Array.from(columns.keys()).sort((a, b) => a - b);
  for (const d of sortedDepths) {
    const indices = columns.get(d)!;
    const colWidth = Math.max(...indices.map((i) => sized[i].w));
    let y = 0;
    for (const i of indices) {
      items[i] = { node: nodes[i], x, y, w: sized[i].w, h: sized[i].h, inner: sized[i].inner };
      y += sized[i].h + GAP_Y;
    }
    height = Math.max(height, y - GAP_Y);
    x += colWidth + GAP_X;
  }
  const width = sortedDepths.length === 0 ? 0 : x - GAP_X;
  return { items, width, height };
}
