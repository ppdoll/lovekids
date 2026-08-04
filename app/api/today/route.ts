import { NextRequest, NextResponse } from "next/server";
import { auth, canTouchKid } from "@/lib/api-auth";
import { getOrCreateSet, toPublic } from "@/lib/daily";
import { Subject, SUBJECTS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if (a instanceof NextResponse) return a;
  const { session, store } = a;

  const kidId = req.nextUrl.searchParams.get("kid") ?? "";
  const subject = req.nextUrl.searchParams.get("subject") ?? "";
  if (!kidId || !SUBJECTS.includes(subject as Subject)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (!canTouchKid(session, kidId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await getOrCreateSet(store, kidId, subject as Subject);
  if (!result.set) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }
  return NextResponse.json(toPublic(result.set));
}
