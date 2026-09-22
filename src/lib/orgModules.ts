import { query } from "@/lib/db";
import { isAdminLevel, type UserRole } from "@/lib/users";
import { MODULE_KEYS, type ModuleKey } from "@/lib/orgModulesDisplay";

export { MODULE_KEYS, MODULE_LABELS, isModuleKey, type ModuleKey } from "@/lib/orgModulesDisplay";

export async function listModulesForDepartment(departmentId: number): Promise<ModuleKey[]> {
  const res = await query<{ module_key: ModuleKey }>(
    `SELECT module_key FROM department_modules WHERE department_id = $1`,
    [departmentId]
  );
  return res.rows.map((r) => r.module_key);
}

// Replaces a Department's full module set — delete-then-reinsert, same
// pattern as setStepPrerequisites/setAttendees.
export async function setModulesForDepartment(departmentId: number, moduleKeys: ModuleKey[]): Promise<void> {
  const unique = Array.from(new Set(moduleKeys)).filter((k) => MODULE_KEYS.includes(k));
  await query(`DELETE FROM department_modules WHERE department_id = $1`, [departmentId]);
  if (unique.length > 0) {
    const values = unique.map((_, i) => `($1, $${i + 2})`).join(", ");
    await query(`INSERT INTO department_modules (department_id, module_key) VALUES ${values}`, [
      departmentId,
      ...unique,
    ]);
  }
}

// The module keys a plain user's own Department maps to — empty if they have
// no Department, or their Department maps to nothing (confirmed default: no
// extra access, just the baseline every user keeps regardless).
export async function getModuleKeysForUser(userId: number): Promise<ModuleKey[]> {
  const res = await query<{ module_key: ModuleKey }>(
    `SELECT dm.module_key FROM employee_details ed
     JOIN department_modules dm ON dm.department_id = ed.department_id
     WHERE ed.user_id = $1`,
    [userId]
  );
  return res.rows.map((r) => r.module_key);
}

// The convenience check every module's page.tsx / API route uses: Admin-level
// always passes; otherwise the user's own Department must map to this module.
// VIEW-only — every write route stays a separate, untouched
// `isAdminLevel(session.role)` check, unaffected by this function.
export async function canAccessModule(
  session: { uid: number; role: UserRole },
  moduleKey: ModuleKey
): Promise<boolean> {
  if (isAdminLevel(session.role)) return true;
  const modules = await getModuleKeysForUser(session.uid);
  return modules.includes(moduleKey);
}
