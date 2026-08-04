/**
 * 부모가 고른 연산 설정이 실제로 지켜지는지 검증.
 *
 * 이 기능의 핵심은 "올림 없는 두 자리 덧셈"처럼 조건이 정확히 지켜지는 것이다.
 * 그래서 생성된 문제를 자리별로 다시 계산해 조건 위반이 하나도 없는지 확인한다.
 *
 * 사전 준비: 개발 서버(npm run dev) 실행
 * 실행: node scripts/test-calc.mjs [베이스URL]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

const digitsOf = (n) => String(n).split("").reverse().map(Number);

/** 두 수를 더할 때 올림이 한 번이라도 생기는가 */
function hasCarry(a, b) {
  const da = digitsOf(a);
  const db = digitsOf(b);
  let carry = 0;
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const s = (da[i] ?? 0) + (db[i] ?? 0) + carry;
    if (s > 9) return true;
    carry = 0;
  }
  return false;
}

/** a - b를 계산할 때 빌려오기가 한 번이라도 필요한가 */
function needsBorrow(a, b) {
  const da = digitsOf(a);
  const db = digitsOf(b);
  let borrow = 0;
  for (let i = 0; i < da.length; i++) {
    const top = da[i] - borrow;
    const bot = db[i] ?? 0;
    if (top < bot) {
      borrow = 1;
      return true;
    }
    borrow = 0;
  }
  return false;
}

async function gen(calc, n = 400) {
  const res = await fetch(`${BASE}/api/dev/calcgen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calc, n }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (개발 서버가 켜져 있나요?)`);
  return (await res.json()).problems;
}

const base = {
  mode: "custom",
  includeWord: false,
  add: { on: false, digits: 2, carry: true },
  sub: { on: false, digits: 2, borrow: true },
  mul: { on: false, tables: [] },
  div: { on: false, remainder: false },
};

const parseBin = (q) => {
  const m = q.match(/^(\d+)\s*([+\-×÷])\s*(\d+)\s*=\s*\?$/);
  return m ? { a: Number(m[1]), op: m[2], b: Number(m[3]) } : null;
};

/* ── 더하기: 자리수 × 올림 여부 ── */
console.log("=== 더하기 ===");
for (const digits of [1, 2, 3, 4]) {
  for (const carry of [true, false]) {
    const ps = await gen({ ...base, add: { on: true, digits, carry } });
    const [lo, hi] = [digits === 1 ? 1 : 10 ** (digits - 1), 10 ** digits - 1];
    let badRange = 0, badCarry = 0, badAnswer = 0;
    for (const p of ps) {
      const e = parseBin(p.q);
      if (!e || e.op !== "+") { badRange++; continue; }
      if (e.a < lo || e.a > hi || e.b < lo || e.b > hi) badRange++;
      if (hasCarry(e.a, e.b) !== carry) badCarry++;
      if (Number(p.answer[0]) !== e.a + e.b) badAnswer++;
    }
    check(
      `${digits}자리 / 올림 ${carry ? "있음" : "없음"} (${ps.length}문제)`,
      badRange === 0 && badCarry === 0 && badAnswer === 0,
      `자리수위반 ${badRange}, 올림조건위반 ${badCarry}, 정답오류 ${badAnswer}`,
    );
  }
}

/* ── 빼기: 자리수 × 빌려주기 여부 ── */
console.log("\n=== 빼기 ===");
for (const digits of [1, 2, 3, 4]) {
  for (const borrow of [true, false]) {
    const ps = await gen({ ...base, sub: { on: true, digits, borrow } });
    const [lo, hi] = [digits === 1 ? 1 : 10 ** (digits - 1), 10 ** digits - 1];
    let badRange = 0, badBorrow = 0, badAnswer = 0, negative = 0;
    for (const p of ps) {
      const e = parseBin(p.q);
      if (!e || e.op !== "-") { badRange++; continue; }
      if (e.a < lo || e.a > hi || e.b < lo || e.b > hi) badRange++;
      if (e.a - e.b < 0) negative++;
      // 한 자리 빼기에는 빌려주기가 존재하지 않으므로 조건 검사에서 제외
      if (digits > 1 && needsBorrow(e.a, e.b) !== borrow) badBorrow++;
      if (Number(p.answer[0]) !== e.a - e.b) badAnswer++;
    }
    check(
      `${digits}자리 / 빌려주기 ${borrow ? "있음" : "없음"} (${ps.length}문제)`,
      badRange === 0 && badBorrow === 0 && badAnswer === 0 && negative === 0,
      `자리수위반 ${badRange}, 빌려주기조건위반 ${badBorrow}, 음수답 ${negative}, 정답오류 ${badAnswer}`,
    );
  }
}

/* ── 곱하기: 고른 단만 나오는지 ── */
console.log("\n=== 곱하기 ===");
for (const tables of [[3], [2, 5], [7, 8, 9], [12, 15, 19]]) {
  const ps = await gen({ ...base, mul: { on: true, tables } });
  let notInTables = 0, badAnswer = 0;
  for (const p of ps) {
    const e = parseBin(p.q);
    if (!e || e.op !== "×") { notInTables++; continue; }
    // 두 수 중 하나는 반드시 고른 단이어야 한다
    if (!tables.includes(e.a) && !tables.includes(e.b)) notInTables++;
    if (Number(p.answer[0]) !== e.a * e.b) badAnswer++;
  }
  check(
    `${tables.join("·")}단만 출제 (${ps.length}문제)`,
    notInTables === 0 && badAnswer === 0,
    `단 위반 ${notInTables}, 정답오류 ${badAnswer}`,
  );
}

/* ── 나누기: 나머지 여부 ── */
console.log("\n=== 나누기 ===");
for (const remainder of [false, true]) {
  const ps = await gen({ ...base, div: { on: true, remainder }, mul: { on: false, tables: [] } });
  let badShape = 0, badAnswer = 0, wrongRemainderState = 0;
  for (const p of ps) {
    const exact = p.q.match(/^(\d+)\s*÷\s*(\d+)\s*=\s*\?$/);
    const asked = p.q.match(/^(\d+)\s*÷\s*(\d+)의 (몫은|나머지는) 얼마일까요\?$/);
    if (exact) {
      const a = Number(exact[1]), b = Number(exact[2]);
      if (a % b !== 0) wrongRemainderState++; // 딱 나눠지는 형태인데 나머지가 있으면 안 됨
      if (Number(p.answer[0]) !== a / b) badAnswer++;
      if (remainder === false) continue;
      // 나머지 포함 설정에서도 딱 나눠지는 문제는 나올 수 있음(허용)
    } else if (asked) {
      const a = Number(asked[1]), b = Number(asked[2]);
      if (!remainder) wrongRemainderState++; // 나머지 없음 설정인데 몫/나머지를 따로 묻는 문제가 나옴
      const want = asked[3] === "몫은" ? Math.floor(a / b) : a % b;
      if (Number(p.answer[0]) !== want) badAnswer++;
      if (a % b === 0) wrongRemainderState++; // 나머지를 묻는데 나머지가 0
    } else {
      badShape++;
    }
  }
  check(
    `나머지 ${remainder ? "있음" : "없음"} (${ps.length}문제)`,
    badShape === 0 && badAnswer === 0 && wrongRemainderState === 0,
    `형식오류 ${badShape}, 정답오류 ${badAnswer}, 나머지조건위반 ${wrongRemainderState}`,
  );
}

/* ── 여러 연산을 함께 켰을 때 ── */
console.log("\n=== 함께 켰을 때 ===");
const mixed = await gen({
  mode: "custom",
  includeWord: false,
  add: { on: true, digits: 2, carry: false },
  sub: { on: true, digits: 2, borrow: true },
  mul: { on: true, tables: [4, 6] },
  div: { on: true, remainder: true },
});
const ops = new Set(mixed.map((p) => parseBin(p.q)?.op ?? (p.q.includes("÷") ? "÷" : "?")));
check("네 연산이 모두 섞여 나옴", ["+", "-", "×", "÷"].every((o) => ops.has(o)), [...ops].join(" "));
check("문장제 제외 설정이 지켜짐", mixed.every((p) => /[+\-×÷]/.test(p.q)), `${mixed.length}문제`);

/* ── 아무 연산도 안 켰을 때 (빈 숙제가 되면 안 됨) ── */
console.log("\n=== 연산을 하나도 안 켰을 때 ===");
const none = await gen({ ...base }, 10);
check("빈 배열을 돌려줌 (호출한 쪽이 학년 자동으로 대체)", none.length === 0, `${none.length}문제`);

/* ── 하루 최대치가 서로 겹치지 않는지 ── */
console.log("\n=== 중복 없이 하루치 생성 ===");
const daily = await gen({ ...base, mul: { on: true, tables: [3] } }, 30);
check(
  "3단만으로 30문제 요청 (조합이 9개뿐이라 만들 수 있는 만큼만)",
  new Set(daily.map((p) => p.q)).size === daily.length,
  `${daily.length}문제 전부 서로 다름`,
);

console.log(failed === 0 ? "\n✅ 연산 설정 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
