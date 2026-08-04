import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/api-auth";
import { getSettings, saveSettings } from "@/lib/daily";
import { issueKidToken, revokeKidToken } from "@/lib/household";

/**
 * 아이 전용 접속 링크 발급/폐기.
 * 아이는 이 링크로만 들어오므로, 링크가 새어나갔다고 판단되면 부모가 새로 발급할 수 있어야 한다.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const a = await authParent(req);
  if (a instanceof NextResponse) return a;
  const { session, store } = a;

  let body: { pin?: string; kidId?: string; action?: "issue" | "revoke" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const settings = await getSettings(store);
  if ((body.pin ?? "") !== settings.parentPin) {
    return NextResponse.json({ error: "wrong-pin" }, { status: 403 });
  }

  const kid = settings.kids.find((k) => k.id === body.kidId);
  if (!kid) return NextResponse.json({ error: "no-kid" }, { status: 404 });

  if (body.action === "revoke") {
    if (kid.accessToken) await revokeKidToken(kid.accessToken);
    delete kid.accessToken;
    await saveSettings(store, settings);
    return NextResponse.json({ ok: true, token: null });
  }

  // 새로 발급하면 이전 링크는 즉시 못 쓰게 된다
  const token = await issueKidToken(session.hh, kid.id, kid.accessToken);
  kid.accessToken = token;
  await saveSettings(store, settings);
  return NextResponse.json({ ok: true, token });
}
