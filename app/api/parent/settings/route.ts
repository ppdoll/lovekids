import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/api-auth";
import { getSettings, saveSettings } from "@/lib/daily";
import { CalcConfig, clampGrade, DEFAULT_CALC, Kid, MUL_TABLES, Subject, SUBJECTS } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  pin?: string;
  kids?: Partial<Kid>[];
  newPin?: string;
}

const bool = (v: unknown, dflt: boolean) => (typeof v === "boolean" ? v : dflt);

/** 화면에서 온 연산 설정을 안전한 값으로 정리 (범위를 벗어난 값이 문제 생성기로 넘어가지 않게) */
function sanitizeCalc(raw: unknown): CalcConfig {
  const c = (raw ?? {}) as Partial<CalcConfig>;
  const digits = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(4, Math.max(1, Math.round(n))) : 2;
  };
  const tables = Array.isArray(c.mul?.tables)
    ? [...new Set(c.mul!.tables.map(Number).filter((t) => MUL_TABLES.includes(t)))].sort((a, b) => a - b)
    : DEFAULT_CALC.mul.tables;

  return {
    mode: c.mode === "custom" ? "custom" : "auto",
    includeWord: bool(c.includeWord, true),
    add: {
      on: bool(c.add?.on, DEFAULT_CALC.add.on),
      digits: digits(c.add?.digits),
      carry: bool(c.add?.carry, DEFAULT_CALC.add.carry),
    },
    sub: {
      on: bool(c.sub?.on, DEFAULT_CALC.sub.on),
      digits: digits(c.sub?.digits),
      borrow: bool(c.sub?.borrow, DEFAULT_CALC.sub.borrow),
    },
    // 곱셈을 켰는데 단을 하나도 안 고른 경우 문제를 못 만들므로 기본 단으로 되돌린다
    mul: {
      on: bool(c.mul?.on, DEFAULT_CALC.mul.on),
      tables: tables.length > 0 ? tables : DEFAULT_CALC.mul.tables,
    },
    div: {
      on: bool(c.div?.on, DEFAULT_CALC.div.on),
      remainder: bool(c.div?.remainder, DEFAULT_CALC.div.remainder),
    },
  };
}

function sanitizeKids(input: Partial<Kid>[], existing: Kid[]): Kid[] | null {
  if (!Array.isArray(input) || input.length > 10) return null;
  const out: Kid[] = [];
  for (const raw of input) {
    const name = String(raw.name ?? "").trim().slice(0, 12);
    if (!name) return null;
    const grade = clampGrade(Number(raw.grade ?? 1));
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
    // 보낸 쪽이 calc를 빼먹었으면 이미 저장돼 있던 설정을 지키다 (실수로 초기화되는 것을 막는다)
    const prevKid = existing.find((k) => k.id === id);
    out.push({
      id,
      name,
      grade,
      emoji,
      perDay,
      calc: raw.calc === undefined && prevKid?.calc ? prevKid.calc : sanitizeCalc(raw.calc),
      // 접속 토큰은 화면에서 오는 값을 믿지 않고, 서버에 저장된 것만 유지한다
      ...(prevKid?.accessToken ? { accessToken: prevKid.accessToken } : {}),
    });
  }
  return out;
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

  if (body.kids) {
    const kids = sanitizeKids(body.kids, settings.kids);
    if (!kids) return NextResponse.json({ error: "bad-kids" }, { status: 400 });
    settings.kids = kids;
  }

  if (body.newPin) {
    if (!/^\d{4,8}$/.test(body.newPin)) {
      return NextResponse.json({ error: "bad-pin" }, { status: 400 });
    }
    settings.parentPin = body.newPin;
  }

  await saveSettings(store, settings);
  return NextResponse.json({ ok: true, kids: settings.kids });
}
