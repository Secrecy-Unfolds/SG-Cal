// Client-safe MoM type/helper — no server-only imports (mirrors
// events.ts's split into eventDisplay.ts). lib/planMinutesOfMeeting.ts
// re-exports this and adds the `query`-based upsert. Client components
// must import from THIS file, not planMinutesOfMeeting.ts, or they'll
// pull `pg` into the browser bundle.

export type MinutesOfMeetingRow = {
  step_id: number;
  attendees: string;
  discussion: string;
  decisions: string;
  action_items: string;
  filled_by: number | null;
  filled_by_username: string | null;
  filled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

// Only `discussion` is required for the completion gate (confirmed
// 2026-09-19) — the substantive field; a short meeting might genuinely
// have no formal decisions or action items yet still be a real,
// completed meeting.
export function isMinutesOfMeetingFilled(mom: Pick<MinutesOfMeetingRow, "discussion"> | null): boolean {
  return !!mom && mom.discussion.trim().length > 0;
}
