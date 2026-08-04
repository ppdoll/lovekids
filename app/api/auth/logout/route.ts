import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  // "/"로 보내면 구글 모드에서는 미들웨어가 /login으로, 집에서만 쓰는 모드에서는 그대로 홈으로 간다.
  // 아이 링크를 열었다가 부모로 돌아올 때도 이 경로를 쓴다.
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
