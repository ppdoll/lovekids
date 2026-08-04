import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSet, toPublic } from "@/lib/daily";
import { familyCodeBlocked } from "@/lib/guard";
import { Subject, SUBJECTS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = familyCodeBlocked(req);
  if (blocked) return blocked;

  const kidId = req.nextUrl.searchParams.get("kid") ?? "";
  const subject = req.nextUrl.searchParams.get("subject") ?? "";
  if (!kidId || !SUBJECTS.includes(subject as Subject)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const result = await getOrCreateSet(kidId, subject as Subject);
  if (!result.set) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }
  return NextResponse.json(toPublic(result.set));
}
