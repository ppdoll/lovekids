import { NextRequest, NextResponse } from "next/server";
import { normalizeCode } from "@/lib/familycode";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const code = normalizeCode(process.env.FAMILY_CODE);
  if (!code) return NextResponse.json({ ok: true });

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  if (normalizeCode(body.code) !== code) {
    return NextResponse.json({ error: "wrong-code" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  // 정규화된 값을 저장해야 미들웨어의 비교와 항상 일치한다
  res.cookies.set("family_code", code, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
