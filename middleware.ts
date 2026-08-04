import { NextRequest, NextResponse } from "next/server";
import { normalizeCode } from "@/lib/familycode";
import { googleEnabled, SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * 접근 통제.
 *
 * 구글 로그인을 설정했으면(GOOGLE_CLIENT_ID/SECRET) 계정 기반으로 막고,
 * 설정하지 않았으면 예전처럼 FAMILY_CODE 방식으로 동작한다.
 * (이미 배포해 쓰고 있는 사이트가 환경변수를 추가하기 전에 잠기지 않도록)
 *
 * 여기서 막는 것은 1차 방어선이고, 각 API 안에서 한 번 더 확인한다.
 */

/** 로그인 없이 열어야 하는 경로 */
function isPublic(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/k/") || // 아이 전용 접속 링크
    pathname.startsWith("/enter") ||
    pathname.startsWith("/api/enter")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (googleEnabled()) {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "login-required" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }
    // 아이 세션은 부모 화면에 들어갈 수 없다
    if (session.kind === "kid" && (pathname === "/parent" || pathname.startsWith("/api/parent"))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "parent-only" }, { status: 403 });
      }
      return NextResponse.redirect(new URL(`/kid/${session.kidId}`, req.url));
    }
    return NextResponse.next();
  }

  // 구글 로그인을 안 쓰는 경우: 가족 코드
  const code = normalizeCode(process.env.FAMILY_CODE);
  if (!code) return NextResponse.next();
  if (normalizeCode(req.cookies.get("family_code")?.value) === code) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "family_code_required" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/enter", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
