import { NextRequest, NextResponse } from "next/server";
import { normalizeCode } from "./familycode";

/**
 * 가족 코드 확인 (2차 방어선).
 *
 * middleware(프록시)에서도 같은 검사를 하지만, Next.js에는 과거에 프록시 계층을
 * 헤더 하나로 건너뛸 수 있는 취약점(CVE-2025-29927)이 있었다. 그때 아이들의 학습 기록이
 * 그대로 노출되지 않도록, 데이터를 내려주는 API에서 한 번 더 직접 확인한다.
 *
 * 통과하면 null, 막아야 하면 401 응답을 돌려준다.
 */
export function familyCodeBlocked(req: NextRequest): NextResponse | null {
  const code = normalizeCode(process.env.FAMILY_CODE);
  if (!code) return null; // 가족 코드를 쓰지 않는 설정(집에서만 사용)
  if (normalizeCode(req.cookies.get("family_code")?.value) === code) return null;
  return NextResponse.json({ error: "family_code_required" }, { status: 401 });
}
