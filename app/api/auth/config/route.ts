import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl, redirectUriFor } from "@/lib/oauth";
import { googleEnabled } from "@/lib/session";

/**
 * 로그인 설정 확인용. 구글 콘솔에 등록해야 할 콜백 주소를 알려준다.
 * redirect_uri_mismatch 오류는 구글 화면에서 끝나 앱으로 돌아오지 않기 때문에,
 * "우리 앱이 실제로 보내는 주소"를 볼 수 있어야 원인을 바로 안다.
 *
 * 여기 담기는 값은 모두 공개되어도 안전한 것뿐이다 (비밀 키는 절대 포함하지 않는다).
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    googleEnabled: googleEnabled(),
    redirectUri: redirectUriFor(req),
    baseUrl: appBaseUrl(req),
    // 주소를 무엇으로 정했는지 (설정이 빠졌을 때 원인 파악용)
    source: process.env.APP_URL
      ? "APP_URL 환경변수"
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? "Vercel 고정 도메인"
        : "접속한 주소",
  });
}
