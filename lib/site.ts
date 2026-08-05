/**
 * 이 사이트의 기준 주소.
 *
 * 공유 미리보기(OG) 이미지 주소는 절대 경로여야 카카오톡·페이스북 크롤러가 읽는다.
 * Vercel의 VERCEL_URL은 배포마다 바뀌므로 쓰지 않고, 고정 도메인을 쓴다.
 * (구글 로그인 콜백 주소와 같은 규칙 — lib/oauth.ts 참고)
 */
export function siteUrl(host?: string | null): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // 환경변수가 없을 때를 대비해 실제 요청이 들어온 주소를 쓴다.
  // (메타데이터는 빌드 시점에 고정되기 쉬운데, 그때 주소를 모르면 localhost로 굳어져
  //  카카오톡 미리보기 이미지가 조용히 깨진다)
  if (host) {
    const scheme = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
    return `${scheme}://${host}`;
  }
  return "http://localhost:3000";
}

export const SITE_NAME = "러브키즈 숙제방";
export const SITE_DESC = "매일매일 우리 아이 숙제, 자동 출제하고 바로 채점해요. 국어·영어·수학을 학년에 맞게.";
export const THEME_COLOR = "#FF8FA8";
export const BG_COLOR = "#FFF9EC";
