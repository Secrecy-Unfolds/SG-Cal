import { redirect } from "next/navigation";

// v3 Phase 1: the Ideas module was rebuilt into Process/Strategy/Idea
// plans (see docs/erp-v3-roadmap.md) — kept as a redirect for one release
// in case of old bookmarks, rather than deleted outright. Remove this
// stub in the same follow-up commit that drops the old `ideas` table.
export default function IdeasPageRedirect() {
  redirect("/plans?type=idea");
}
