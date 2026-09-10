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

export type UserSummary = {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  created_at: Date;
};

export async function listUsers(): Promise<UserSummary[]> {
  const res = await query<UserSummary>(
    "SELECT id, username, email, role, created_at FROM users ORDER BY id ASC"
  );
  return res.rows;
}

export async function usernameExists(username: string): Promise<boolean> {
  const res = await query<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);
  return res.rows.length > 0;
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
     RETURNING id, username, email, role, created_at`,
    [input.username, input.passwordHash, input.email, input.role]
  );
  return res.rows[0];
}
