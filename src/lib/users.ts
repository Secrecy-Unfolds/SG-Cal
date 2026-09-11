import { query } from "@/lib/db";

export type UserRole = "user" | "admin" | "super_admin";

export function isUserRole(value: unknown): value is UserRole {
  return value === "user" || value === "admin" || value === "super_admin";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
};

// Admin and Super Admin are treated identically everywhere access is gated
// by "Admin-level" (Manage Users, Procurement Planning) — only plain "user"
// is excluded.
export function isAdminLevel(role: UserRole): role is "admin" | "super_admin" {
  return role !== "user";
}

export type UserSummary = {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  created_at: Date;
  name: string;
  phone: string;
  picture_url: string | null;
};

const USER_SUMMARY_SELECT = "id, username, email, role, created_at, name, phone, picture_url";

export async function listUsers(): Promise<UserSummary[]> {
  const res = await query<UserSummary>(
    `SELECT ${USER_SUMMARY_SELECT} FROM users ORDER BY id ASC`
  );
  return res.rows;
}

export async function getUserById(id: number): Promise<UserSummary | null> {
  const res = await query<UserSummary>(
    `SELECT ${USER_SUMMARY_SELECT} FROM users WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

// Excludes selfId so a user saving their profile without changing their own
// username doesn't collide with themselves.
export async function usernameExists(username: string, excludeId?: number): Promise<boolean> {
  const res = excludeId
    ? await query<{ id: number }>("SELECT id FROM users WHERE username = $1 AND id != $2", [username, excludeId])
    : await query<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);
  return res.rows.length > 0;
}

export async function updateProfile(
  id: number,
  input: { name: string; username: string; email: string; phone: string }
): Promise<UserSummary> {
  const res = await query<UserSummary>(
    `UPDATE users SET name = $1, username = $2, email = $3, phone = $4
     WHERE id = $5
     RETURNING ${USER_SUMMARY_SELECT}`,
    [input.name, input.username, input.email, input.phone, id]
  );
  return res.rows[0];
}

// Escalating permissions: a "user" can't add accounts at all; an "admin" can
// only add plain "user" accounts; "super_admin" can additionally grant
// "admin". Super Admin itself is never assignable through this — there can
// only ever be one in the system, set directly in the database.
export async function canAssignRole(actorRole: UserRole, targetRole: UserRole): Promise<string | null> {
  if (targetRole === "super_admin") {
    return "Super Admin can't be assigned here — there can only ever be one";
  }
  if (actorRole === "user") {
    return "Only Admins and Super Admins can add users";
  }
  if (actorRole === "admin" && targetRole !== "user") {
    return "Admins can only add User accounts — ask a Super Admin to add an Admin account";
  }
  return null;
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  email: string;
  role: UserRole;
}): Promise<UserSummary> {
  const res = await query<UserSummary>(
    `INSERT INTO users (username, password_hash, email, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_SUMMARY_SELECT}`,
    [input.username, input.passwordHash, input.email, input.role]
  );
  return res.rows[0];
}

export async function updateUserRole(id: number, role: UserRole): Promise<UserSummary | null> {
  const res = await query<UserSummary>(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING ${USER_SUMMARY_SELECT}`,
    [role, id]
  );
  return res.rows[0] ?? null;
}

// Whether actorRole can edit a targetRole account's profile details (name,
// username, email, phone) — same escalation shape as canAssignRole, but a
// plain boolean since there's only one rejection reason worth surfacing.
export function canEditUserDetails(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "super_admin") return targetRole !== "super_admin";
  if (actorRole === "admin") return targetRole === "user";
  return false;
}
