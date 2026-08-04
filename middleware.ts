import { NextRequest, NextResponse } from "next/server";
import { normalizeCode } from "@/lib/familycode";

/** FAMILY_CODE 환경변수가 설정된 경우, 가족 코드 입력 전에는 접근을 막는다. */
export function middleware(req: NextRequest) {
  const code = normalizeCode(process.env.FAMILY_CODE);
  if (!code) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/enter") || pathname.startsWith("/api/enter")) {
    return NextResponse.next();
  }

  if (normalizeCode(req.cookies.get("family_code")?.value) === code) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "family_code_required" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/enter";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
