import { NextRequest, NextResponse } from "next/server";
import { auth, canTouchKid } from "@/lib/api-auth";
import { submitRetry } from "@/lib/daily";
import { Subject, SUBJECTS } from "@/lib/types";

/**
 * 틀린 문제 다시 풀기 채점.
 *
 * /api/answer 와 따로 둔다. 첫 시도 채점은 점수·달력·연속 달성·오답 노트를 모두 건드리므로,
 * 복습용 재채점이 그 경로를 지나가지 않게 하는 편이 안전하다.
 */
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

  const result = await submitRetry(store, kidId, subject as Subject, index, given);
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
