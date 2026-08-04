import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/api-auth";
import { genCustomProblems } from "@/lib/mathgen";
import { CalcConfig } from "@/lib/types";

/** 개발 전용: 연산 설정 검증용. 운영 빌드에서는 항상 404. */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const a = await authParent(req);
  if (a instanceof NextResponse) return a;
  let body: { calc?: CalcConfig; n?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!body.calc) return NextResponse.json({ error: "no-calc" }, { status: 400 });
  const n = Math.min(2000, Math.max(1, Number(body.n ?? 300)));
  return NextResponse.json({ problems: genCustomProblems(body.calc, n) });
}
