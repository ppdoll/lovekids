import { NextRequest, NextResponse } from "next/server";
import { resolveKidToken } from "@/lib/household";
import { cookieOptions, SESSION_COOKIE, signSession } from "@/lib/session";

/**
 * 아이 전용 접속 링크.
 * 아이는 이 링크를 한 번 열면(홈 화면에 추가해두면) 로그인 없이 자기 숙제만 풀 수 있다.
 * 부모 화면과 다른 아이의 기록에는 접근할 수 없다.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const target = await resolveKidToken(token);
  if (!target) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "kid-link");
    return NextResponse.redirect(url);
  }

  const session = await signSession({ kind: "kid", hh: target.hh, kidId: target.kidId }, 365);
  const res = NextResponse.redirect(new URL(`/kid/${target.kidId}`, req.url));
  res.cookies.set(SESSION_COOKIE, session, cookieOptions(365));
  return res;
}
