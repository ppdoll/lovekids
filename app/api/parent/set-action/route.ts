import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/api-auth";
import { addToToday, getSettings, resetToday } from "@/lib/daily";
import { Subject, SUBJECTS } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  pin?: string;
  kidId?: string;
  subject?: string;
  action?: "reset" | "add";
  count?: number;
}

export async function POST(req: NextRequest) {
  const a = await authParent(req);
  if (a instanceof NextResponse) return a;
  const { store } = a;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const settings = await getSettings(store);
  if ((body.pin ?? "") !== settings.parentPin) {
    return NextResponse.json({ error: "wrong-pin" }, { status: 403 });
  }

  const { kidId, subject, action } = body;
  if (!kidId || !SUBJECTS.includes(subject as Subject) || (action !== "reset" && action !== "add")) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (!settings.kids.some((k) => k.id === kidId)) {
    return NextResponse.json({ error: "no-kid" }, { status: 404 });
  }

  if (action === "reset") {
    await resetToday(store, kidId, subject as Subject);
    return NextResponse.json({ ok: true });
  }

  const count = Math.min(20, Math.max(1, Math.round(Number(body.count ?? 5))));
  const result = await addToToday(store, kidId, subject as Subject, count);
  if ("error" in result) {
    return NextResponse.json(result, { status: result.error === "no-more" ? 409 : 400 });
  }
  return NextResponse.json({ ok: true, ...result });
}
