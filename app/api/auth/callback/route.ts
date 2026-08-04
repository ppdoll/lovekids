import { NextRequest, NextResponse } from "next/server";
import { ensureHousehold } from "@/lib/household";
import { exchangeCode, redirectUriFor, STATE_COOKIE } from "@/lib/oauth";
import { cookieOptions, googleEnabled, SESSION_COOKIE, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const fail = (req: NextRequest, why: string) => {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", why);
  return NextResponse.redirect(url);
};

export async function GET(req: NextRequest) {
  if (!googleEnabled()) return fail(req, "not-configured");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const saved = req.cookies.get(STATE_COOKIE)?.value;

  // 로그인 요청이 우리 화면에서 시작된 것인지 확인 (CSRF 방지)
  if (!code || !state || !saved || state !== saved) return fail(req, "state");

  const user = await exchangeCode(code, redirectUriFor(req));
  if (!user) return fail(req, "exchange");

  const hh = await ensureHousehold(user.sub);
  const token = await signSession({
    kind: "parent",
    hh,
    sub: user.sub,
    email: user.email,
    name: user.name,
  });

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  res.cookies.delete(STATE_COOKIE);
  return res;
}
