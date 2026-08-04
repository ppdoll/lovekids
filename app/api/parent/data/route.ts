import { NextRequest, NextResponse } from "next/server";
import { bankCounts } from "@/lib/bank";
import { calcStreak, getSettings, kidToday } from "@/lib/daily";
import { kvGet, storageMode } from "@/lib/store";
import { todayKST } from "@/lib/date";
import { History, WrongItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const pin = req.headers.get("x-pin") ?? "";
  const settings = await getSettings();
  if (pin !== settings.parentPin) {
    return NextResponse.json({ error: "wrong-pin" }, { status: 403 });
  }

  const kids = [];
  for (const kid of settings.kids) {
    const [history, wrong, today] = await Promise.all([
      kvGet<History>(`history:${kid.id}`),
      kvGet<WrongItem[]>(`wrong:${kid.id}`),
      kidToday(kid),
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
  });
}
