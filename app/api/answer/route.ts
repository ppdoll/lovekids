import { NextRequest, NextResponse } from "next/server";
import { submitAnswer } from "@/lib/daily";
import { familyCodeBlocked } from "@/lib/guard";
import { Subject, SUBJECTS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = familyCodeBlocked(req);
  if (blocked) return blocked;

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
  const result = await submitAnswer(kidId, subject as Subject, index, given);
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
