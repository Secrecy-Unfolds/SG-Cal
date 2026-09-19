import { query } from "@/lib/db";

// Single source of truth for the client-safe pieces lives in
// planMinutesOfMeetingDisplay.ts (no server-only imports) — see its own
// comment. Re-exported here so every existing server-side import site
// (lib/planSteps.ts, the API routes) keeps working unchanged.
export type { MinutesOfMeetingRow } from "@/lib/planMinutesOfMeetingDisplay";
export { isMinutesOfMeetingFilled } from "@/lib/planMinutesOfMeetingDisplay";

// One row per step (PK is step_id) — an upsert target, not
// insert-then-update. filled_by/filled_at update on every save, matching
// the "who last touched this" convention deliverable defs also use.
export async function upsertMinutesOfMeeting(
  stepId: number,
  input: { attendees: string; discussion: string; decisions: string; actionItems: string },
  filledBy: number
): Promise<void> {
  await query(
    `INSERT INTO minutes_of_meeting (step_id, attendees, discussion, decisions, action_items, filled_by, filled_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (step_id) DO UPDATE SET
       attendees = EXCLUDED.attendees,
       discussion = EXCLUDED.discussion,
       decisions = EXCLUDED.decisions,
       action_items = EXCLUDED.action_items,
       filled_by = EXCLUDED.filled_by,
       filled_at = now(),
       updated_at = now()`,
    [stepId, input.attendees, input.discussion, input.decisions, input.actionItems, filledBy]
  );
}
