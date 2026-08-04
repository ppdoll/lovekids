import { NextRequest, NextResponse } from "next/server";
import { auth, canTouchKid } from "@/lib/api-auth";
import { submitAnswer } from "@/lib/daily";
import { Subject, SUBJECTS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const a = await auth(req);
  if (a instanceof NextResponse) return a;
  const { session, store } = a;

  let body: { kidId?: string; subject?: string; index?: number; given?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const { kidId, subject, index, given } = body;
  if (
    !kidId ||
    !SUBJECTS.includes(subject as Subject) ||
    typeof index !== "number" ||
    typeof given !== "string"
  ) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (!canTouchKid(session, kidId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await submitAnswer(store, kidId, subject as Subject, index, given);
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
