import { NextRequest, NextResponse } from "next/server";
import { authUrl, randomState, redirectUriFor, STATE_COOKIE } from "@/lib/oauth";
import { googleEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!googleEnabled()) {
    return NextResponse.json({ error: "google-not-configured" }, { status: 501 });
  }
  const state = randomState();
  // login_hint는 구글이 계정 선택에 쓰는 표준 파라미터 (테스트에서도 계정을 지정하는 데 쓴다)
  const hint = req.nextUrl.searchParams.get("login_hint") ?? undefined;
  const res = NextResponse.redirect(authUrl(redirectUriFor(req), state, hint));
  // state는 콜백에서 대조만 하면 되므로 짧게 유지한다
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
