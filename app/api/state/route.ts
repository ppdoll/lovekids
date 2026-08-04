import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { calcStreak, getSettings, kidToday } from "@/lib/daily";
import { storageMode } from "@/lib/store";
import { todayKST } from "@/lib/date";
import { History } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if (a instanceof NextResponse) return a;
  const { session, store } = a;

  const settings = await getSettings(store);
  // 아이 세션이면 자기 자신만 보인다 (형제의 기록도 보이지 않게)
  const visible =
    session.kind === "kid" ? settings.kids.filter((k) => k.id === session.kidId) : settings.kids;

  const kids = [];
  for (const kid of visible) {
    const [today, history] = await Promise.all([
      kidToday(store, kid),
      store.get<History>(`history:${kid.id}`),
    ]);
    kids.push({
      id: kid.id,
      name: kid.name,
      grade: kid.grade,
      emoji: kid.emoji,
      perDay: kid.perDay,
      today,
      streak: calcStreak(kid, history ?? {}),
    });
  }

  return NextResponse.json({
    date: todayKST(),
    kids,
    storage: storageMode(),
    needsSetup: settings.kids.length === 0,
    role: session.kind,
    account: session.kind === "parent" ? { email: session.email, name: session.name } : null,
  });
}
