/**
 * 구글 OAuth 2.0 (Authorization Code) 최소 구현.
 *
 * 라이브러리를 쓰지 않은 이유: 이 앱은 부모 세션과 아이 전용 세션 두 종류를 다뤄야 하는데
 * 기성 라이브러리가 그 구조를 그대로 주지 못하고, Next 16과의 호환도 아직 불안하다.
 * 대신 아래 보안 요소를 직접 지킨다.
 *  - state: 로그인 요청을 위조하지 못하게(CSRF) 짧은 수명 쿠키와 대조
 *  - 토큰 교환: 브라우저를 거치지 않고 서버가 구글과 직접 HTTPS로 주고받는다
 *  - aud/iss 확인: 받은 ID 토큰이 우리 앱(우리 client_id)용인지, 발급자가 구글인지 확인
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

/**
 * 테스트에서 가짜 구글 서버를 쓸 수 있게 하는 우회.
 * 단, **내 컴퓨터(localhost) 주소만** 허용한다. 그래서 혹시 운영 환경에 이 변수가 들어가도
 * 외부 서버로 로그인 요청이 새어나갈 수 없다.
 */
function endpoint(kind: "auth" | "token"): string {
  const override = kind === "auth" ? process.env.OAUTH_AUTH_URL : process.env.OAUTH_TOKEN_URL;
  if (override) {
    try {
      const h = new URL(override).hostname;
      if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return override;
    } catch {
      /* 형식이 잘못됐으면 무시하고 실제 구글로 */
    }
  }
  return kind === "auth" ? GOOGLE_AUTH : GOOGLE_TOKEN;
}

export const STATE_COOKIE = "lk_oauth_state";

export function randomState(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function authUrl(redirectUri: string, state: string, loginHint?: string): string {
  const u = new URL(endpoint("auth"));
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  if (loginHint) u.searchParams.set("login_hint", loginHint);
  return u.toString();
}

export interface GoogleUser {
  sub: string;
  email?: string;
  name?: string;
}

/** JWT 본문만 꺼낸다 (서버가 구글과 직접 HTTPS로 받은 토큰이라 서명 검증은 전송 계층이 담보한다) */
function decodePayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64 + "=".repeat((4 - (b64.length % 4)) % 4), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleUser | null> {
  const res = await fetch(endpoint("token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const json = (await res.json().catch(() => null)) as { id_token?: string } | null;
  if (!json?.id_token) return null;

  const p = decodePayload(json.id_token);
  if (!p) return null;

  // 우리 앱용으로 발급된 토큰인지, 구글이 발급한 것인지 확인
  const aud = p.aud;
  if (typeof aud !== "string" || aud !== process.env.GOOGLE_CLIENT_ID) return null;
  const iss = typeof p.iss === "string" ? p.iss : "";
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") return null;
  if (typeof p.sub !== "string" || !p.sub) return null;

  return {
    sub: p.sub,
    email: typeof p.email === "string" ? p.email : undefined,
    name: typeof p.name === "string" ? p.name : undefined,
  };
}

/** 배포 주소를 신뢰할 수 있는 값으로만 만든다 (Host 헤더를 그대로 쓰면 위조에 쓰일 수 있다) */
export function redirectUriFor(req: Request): string {
  const configured = process.env.APP_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`);
  if (configured) return new URL("/api/auth/callback", configured).toString();
  return new URL("/api/auth/callback", new URL(req.url).origin).toString();
}
