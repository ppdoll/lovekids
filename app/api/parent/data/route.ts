import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/api-auth";
import { bankCounts } from "@/lib/bank";
import { calcStreak, getSettings, kidToday } from "@/lib/daily";
import { storageEnvNames, storageMode, storageVia, storageWriteError } from "@/lib/store";
import { todayKST } from "@/lib/date";
import { googleEnabled } from "@/lib/session";
import { History, WrongItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const a = await authParent(req);
  if (a instanceof NextResponse) return a;
  const { session, store } = a;

  const pin = req.headers.get("x-pin") ?? "";
  const settings = await getSettings(store);
  if (pin !== settings.parentPin) {
    return NextResponse.json({ error: "wrong-pin" }, { status: 403 });
  }

  const kids = [];
  for (const kid of settings.kids) {
    const [history, wrong, today] = await Promise.all([
      store.get<History>(`history:${kid.id}`),
      store.get<WrongItem[]>(`wrong:${kid.id}`),
      kidToday(store, kid),
    ]);
    kids.push({
      ...kid,
      history: history ?? {},
      wrong: (wrong ?? []).slice().reverse(),
      today,
      streak: calcStreak(kid, history ?? {}),
    });
  }

  return NextResponse.json({
    date: todayKST(),
    kids,
    bank: bankCounts(),
    storage: storageMode(),
    // 저장소가 안 잡힐 때 원인을 화면에서 바로 알 수 있도록 (변수 이름만, 값은 절대 포함하지 않음)
    storageVia: storageVia(),
    storageEnv: storageEnvNames(),
    storageError: storageWriteError(),
    onVercel: !!process.env.VERCEL,
    googleEnabled: googleEnabled(),
    account: session.kind === "parent" ? { email: session.email, name: session.name } : null,
  });
}
