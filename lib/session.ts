import { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

/**
 * 세션은 두 종류다.
 *  - parent: 구글로 로그인한 부모. 모든 기능 사용.
 *  - kid: 아이 전용 접속 링크로 들어온 아이. 자기 숙제만 풀 수 있고 부모 화면은 못 본다.
 *    (7살에게 구글 로그인을 시킬 수는 없으니 링크 방식이 필요하다)
 *
 * 어느 쪽이든 householdId(가정)를 세션에 담는다. 클라이언트가 보낸 값은 절대 믿지 않는다.
 */

export const SESSION_COOKIE = "lk_session";
/** 구글 로그인을 설정하지 않은 경우(집에서만 쓰는 모드)에 쓰는 고정 가정 ID */
export const SOLO_HOUSEHOLD = "home";

export interface ParentSession {
  kind: "parent";
  hh: string;
  sub: string; // 구글 계정 식별자
  email?: string;
  name?: string;
}

export interface KidSession {
  kind: "kid";
  hh: string;
  kidId: string;
}

export type Session = ParentSession | KidSession;

/** 구글 로그인을 쓸 수 있는 설정인가 */
export function googleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function secretKey(): Uint8Array {
  const s =
    process.env.SESSION_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET || // 별도로 안 넣었으면 이걸로 대체
    "lovekids-dev-only-secret-change-me";
  // HMAC-SHA256에 쓸 32바이트 이상 키를 만든다
  const bytes = new TextEncoder().encode(s.padEnd(32, "_"));
  return bytes;
}

export async function signSession(s: Session, days = 60): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind === "parent" && typeof payload.hh === "string" && typeof payload.sub === "string") {
      return {
        kind: "parent",
        hh: payload.hh,
        sub: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
      };
    }
    if (payload.kind === "kid" && typeof payload.hh === "string" && typeof payload.kidId === "string") {
      return { kind: "kid", hh: payload.hh, kidId: payload.kidId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 요청에서 세션을 읽는다.
 * 구글 로그인을 설정하지 않았으면 예전처럼 한 가정 전용으로 동작한다
 * (이미 배포해서 쓰고 있는 사이트가 갑자기 잠기지 않도록).
 */
export async function getSession(req: NextRequest): Promise<Session | null> {
  const fromCookie = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  if (!googleEnabled()) {
    return { kind: "parent", hh: SOLO_HOUSEHOLD, sub: "solo" };
  }
  return null;
}

export function cookieOptions(days = 60) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * days,
    path: "/",
  };
}
