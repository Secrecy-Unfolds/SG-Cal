import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SessionPayload, verifySessionToken } from "@/lib/session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// For use inside Route Handlers / Server Components (reads the incoming cookie jar).
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export { SESSION_COOKIE, secondsUntilNextMuscatMidnight, signSession } from "@/lib/session";
