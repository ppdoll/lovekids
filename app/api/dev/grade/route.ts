import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/api-auth";
import { isCorrect } from "@/lib/daily";
import { Problem } from "@/lib/types";

/**
 * 개발 전용: 채점 로직 검증용. 운영 빌드에서는 항상 404.
 *
 * 채점은 아이 경험에서 가장 중요한 부분이다. 아는데도 오답으로 처리되면
 * 아이가 억울해하고 앱을 믿지 않게 된다. 그래서 채점만 따로 시험할 수 있게 열어둔다.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const a = await authParent(req);
  if (a instanceof NextResponse) return a;

  let body: { cases?: { answer: Problem["answer"]; type?: "mc" | "short"; given: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!Array.isArray(body.cases)) return NextResponse.json({ error: "no-cases" }, { status: 400 });

  const results = body.cases.slice(0, 500).map((c) => {
    const problem = { id: "x", type: c.type ?? "short", q: "x", answer: c.answer } as Problem;
    return { given: c.given, correct: isCorrect(problem, c.given) };
  });
  return NextResponse.json({ results });
}
