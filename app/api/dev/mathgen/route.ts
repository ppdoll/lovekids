import { NextRequest, NextResponse } from "next/server";
import { genMathProblems } from "@/lib/mathgen";

/** 개발 전용: 수학 생성기 검증용. 운영 빌드에서는 항상 404. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const grade = Number(req.nextUrl.searchParams.get("grade") ?? 1);
  const n = Math.min(2000, Number(req.nextUrl.searchParams.get("n") ?? 300));
  return NextResponse.json({ grade, problems: genMathProblems(grade, n) });
}
