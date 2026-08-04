import { NextRequest, NextResponse } from "next/server";
import { Store, storeFor } from "./scope";
import { getSession, Session } from "./session";

/**
 * API에서 쓰는 인증 도우미.
 *
 * 규칙:
 *  - 저장소는 반드시 세션의 householdId로 묶인 것만 쓴다. 요청 본문의 값은 믿지 않는다.
 *  - 아이 세션은 자기 자신의 kidId만 다룰 수 있다.
 *  - 부모 전용 기능(설정·오답 노트·리셋)은 아이 세션이면 막는다.
 */

export interface AuthOk {
  session: Session;
  store: Store;
}

export async function auth(req: NextRequest): Promise<AuthOk | NextResponse> {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }
  return { session, store: storeFor(session.hh) };
}

/** 부모만 허용 */
export async function authParent(req: NextRequest): Promise<AuthOk | NextResponse> {
  const a = await auth(req);
  if (a instanceof NextResponse) return a;
  if (a.session.kind !== "parent") {
    return NextResponse.json({ error: "parent-only" }, { status: 403 });
  }
  return a;
}

/**
 * 이 세션이 해당 아이를 다룰 수 있는지.
 * 아이 세션이 남의 kidId를 지정해 보내는 것을 막는 마지막 방어선이다.
 */
export function canTouchKid(session: Session, kidId: string): boolean {
  if (session.kind === "parent") return true;
  return session.kidId === kidId;
}
