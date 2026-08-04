import { NextRequest, NextResponse } from "next/server";
import { calcStreak, getSettings, kidToday } from "@/lib/daily";
import { familyCodeBlocked } from "@/lib/guard";
import { kvGet, storageMode } from "@/lib/store";
import { todayKST } from "@/lib/date";
import { History } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = familyCodeBlocked(req);
  if (blocked) return blocked;

  const settings = await getSettings();
  const kids = [];
  for (const kid of settings.kids) {
    const [today, history] = await Promise.all([
      kidToday(kid),
      kvGet<History>(`history:${kid.id}`),
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
  });
}
