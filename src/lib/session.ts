import { SignJWT, jwtVerify } from "jose";
import { muscatTodayRangeUTC } from "@/lib/time";
import type { UserRole } from "@/lib/users";

export const SESSION_COOKIE = "session";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  uid: number;
  username: string;
  role: UserRole;
};

// Sessions expire at the next midnight (Asia/Muscat), not on a rolling
// window — logging in at 8pm gets a shorter session than logging in at 8am.
function nextMuscatMidnightUTC(): Date {
  return muscatTodayRangeUTC().end;
}

export function secondsUntilNextMuscatMidnight(): number {
  return Math.max(1, Math.round((nextMuscatMidnightUTC().getTime() - Date.now()) / 1000));
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const expEpochSeconds = Math.floor(nextMuscatMidnightUTC().getTime() / 1000);
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expEpochSeconds)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.uid !== "number" ||
      typeof payload.username !== "string" ||
      (payload.role !== "user" && payload.role !== "admin" && payload.role !== "super_admin")
    ) {
      return null;
    }
    return { uid: payload.uid, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}
