import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/daily";
import { familyCodeBlocked } from "@/lib/guard";
import { Kid, Subject, SUBJECTS } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  pin?: string;
  kids?: Partial<Kid>[];
  newPin?: string;
}

function sanitizeKids(input: Partial<Kid>[]): Kid[] | null {
  if (!Array.isArray(input) || input.length > 10) return null;
  const out: Kid[] = [];
  for (const raw of input) {
    const name = String(raw.name ?? "").trim().slice(0, 12);
    if (!name) return null;
    const grade = Math.min(6, Math.max(1, Math.round(Number(raw.grade ?? 1))));
    const emoji = String(raw.emoji ?? "🦁").slice(0, 4);
    const perDay = {} as Record<Subject, number>;
    for (const s of SUBJECTS) {
      const v = Number(raw.perDay?.[s] ?? 0);
      perDay[s] = Number.isFinite(v) ? Math.min(30, Math.max(0, Math.round(v))) : 0;
    }
    const id =
      typeof raw.id === "string" && raw.id
        ? raw.id
        : `k${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    out.push({ id, name, grade, emoji, perDay });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const blocked = familyCodeBlocked(req);
  if (blocked) return blocked;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const settings = await getSettings();
  if ((body.pin ?? "") !== settings.parentPin) {
    return NextResponse.json({ error: "wrong-pin" }, { status: 403 });
  }

  if (body.kids) {
    const kids = sanitizeKids(body.kids);
    if (!kids) return NextResponse.json({ error: "bad-kids" }, { status: 400 });
    settings.kids = kids;
  }

  if (body.newPin) {
    if (!/^\d{4,8}$/.test(body.newPin)) {
      return NextResponse.json({ error: "bad-pin" }, { status: 400 });
    }
    settings.parentPin = body.newPin;
  }

  await saveSettings(settings);
  return NextResponse.json({ ok: true, kids: settings.kids });
}
