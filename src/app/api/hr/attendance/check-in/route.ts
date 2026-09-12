import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkIn } from "@/lib/hr";
import { getMuscatNowParts } from "@/lib/time";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dateKey } = getMuscatNowParts();
  const record = await checkIn(session.uid, dateKey);
  return NextResponse.json({ record });
}
