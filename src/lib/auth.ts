import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { SESSION_COOKIE, SessionPayload, verifySessionToken } from "@/lib/session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Ambiguous characters (0/O, 1/l/I) are excluded since this is read off an
// email and typed in by hand, not pasted from a password manager.
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTempPassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join("");
}

// For use inside Route Handlers / Server Components (reads the incoming cookie jar).
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return withFreshUserFields(session);
}

// The token is a snapshot from login time, so the username in it goes stale
// when someone else (a Super Admin) renames you — and a password reset flags
// an account that may already have a session open. Both are read fresh here
// (one tiny indexed lookup), the same idea as the sidebar avatar being
// fetched per request. If the lookup fails or the row is gone, fall back to
// the token rather than locking anyone out. Role deliberately still comes
// from the token (unchanged behavior).
async function withFreshUserFields(session: SessionPayload): Promise<SessionPayload> {
  try {
    const res = await query<{ username: string; must_change_password: boolean }>(
      "SELECT username, must_change_password FROM users WHERE id = $1",
      [session.uid]
    );
    const row = res.rows[0];
    if (!row) return session;
    const { mcp: _tokenFlag, ...rest } = session;
    void _tokenFlag;
    return { ...rest, username: row.username, ...(row.must_change_password ? { mcp: true } : {}) };
  } catch {
    return session;
  }
}

export { SESSION_COOKIE, secondsUntilNextMuscatMidnight, signSession } from "@/lib/session";
