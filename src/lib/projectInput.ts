import { listCurrencies } from "@/lib/currencies";
import { isProjectStatus } from "@/lib/projectDisplay";
import type { ProjectInput } from "@/lib/projects";

// Shared by POST /api/projects and PUT /api/projects/[id] so both validate
// the body identically. The currency must be one from the fixed currencies
// list (see lib/currencies.ts), like every other currency field in the app.
export async function parseProjectBody(body: any): Promise<{ ok: true; input: ProjectInput } | { ok: false; error: string }> {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const status = isProjectStatus(body?.status) ? body.status : "planning";
  const startDate = typeof body?.startDate === "string" && body.startDate ? body.startDate : null;
  const targetEndDate = typeof body?.targetEndDate === "string" && body.targetEndDate ? body.targetEndDate : null;
  const budget = typeof body?.budget === "number" ? body.budget : null;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const departmentId = typeof body?.departmentId === "number" ? body.departmentId : null;
  const projectHeadId = typeof body?.projectHeadId === "number" ? body.projectHeadId : null;

  if (!name) return { ok: false, error: "A project name is required" };
  if (departmentId === null) return { ok: false, error: "Choose the department this project belongs to" };
  if (projectHeadId === null) return { ok: false, error: "Choose the Project Head" };
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if ((startDate && !dateRe.test(startDate)) || (targetEndDate && !dateRe.test(targetEndDate))) {
    return { ok: false, error: "Invalid date" };
  }
  if (!(await listCurrencies()).includes(currency)) return { ok: false, error: "Unknown currency" };

  return {
    ok: true,
    input: { name, description, status, startDate, targetEndDate, budget, currency, departmentId, projectHeadId },
  };
}
