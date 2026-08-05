/**
 * 수학 자동 생성 문제 검증.
 * 개발 서버(npm run dev)가 떠 있는 상태에서 실행하면, 실제 앱이 쓰는 코드 그대로 검증한다.
 *   1) 하루 최대치(30문제)가 서로 겹치지 않는지
 *   2) mc/short 형식이 올바른지
 *   3) "3 + 5 = ?" 같은 계산식은 식을 직접 계산해 정답과 일치하는지
 *   4) 문장형 문제는 유형별 표본을 출력 (눈으로 확인)
 *
 * 실행: node scripts/test-mathgen.mjs [베이스URL]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status} (개발 서버가 켜져 있나요? npm run dev)`);
  return r.json();
};

/**
 * "3 + 5 = ?" / "1/4 ÷ 3/4 = ?" 같은 식을 계산한다.
 * 주의: 슬래시는 분수 막대이므로 나눗셈으로 바꿔 통째로 계산하면 안 된다
 * (1/4 ÷ 3/4 를 그대로 계산하면 ((1/4)/3)/4 가 되어 틀린다).
 * 그래서 먼저 +, -, ×, ÷ 로 잘라 각 항을 분수로 해석한 뒤, × ÷ 를 먼저 계산한다.
 */
function evalExpr(line) {
  const m = line.match(/^([\d\s+\-×÷/.]+)=\s*\?$/);
  if (!m) return null;
  const tokens = m[1].trim().split(/\s*([+\-×÷])\s*/).filter((t) => t !== "");
  if (tokens.length % 2 === 0) return null; // 항-연산자-항 형태여야 한다

  const operand = (t) => {
    const f = t.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (f) return Number(f[2]) === 0 ? null : Number(f[1]) / Number(f[2]);
    if (!/^\d+(?:\.\d+)?$/.test(t)) return null;
    return Number(t);
  };

  // 1단계: × ÷ 먼저
  const vals = [];
  const ops = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      const v = operand(tokens[i]);
      if (v === null) return null;
      const op = ops[ops.length - 1];
      if (op === "×" || op === "÷") {
        ops.pop();
        const prev = vals.pop();
        if (op === "÷" && v === 0) return null;
        vals.push(op === "×" ? prev * v : prev / v);
      } else {
        vals.push(v);
      }
    } else {
      ops.push(tokens[i]);
    }
  }
  // 2단계: + - 를 왼쪽부터
  let acc = vals[0];
  for (let i = 0; i < ops.length; i++) acc = ops[i] === "+" ? acc + vals[i + 1] : acc - vals[i + 1];
  return Number.isFinite(acc) ? acc : null;
}

/** 정답 문자열 → 수치 (분수 a/b 지원) */
function answerValue(p) {
  const a = Array.isArray(p.answer) ? p.answer[0] : null;
  if (a === null) return null;
  const f = String(a).match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  const n = Number(String(a).replace(/[^\d.\-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/**
 * 식을 교과서 표기대로 썼는지.
 *
 * "y = 3x + 0", "y = 1x", "x² + 1x - 6", "(x + 0)²" 은 답은 맞지만 아이가 배운 표기와
 * 달라서 문제가 잘못된 것처럼 보인다. 계수 1은 생략하고 0인 항은 쓰지 않아야 한다.
 * 소수("6.9 + 0.9")와 좌표 계산("(-6 - 0) ÷ 2")은 정상이므로 건드리지 않는다.
 */
const NOTATION = [
  [/[+\-] 0(?![.\d])/, "0인 항을 그대로 씀"],
  [/(^|[^\d.])1(x|y)/, "계수 1을 그대로 씀"],
  [/\(x [+\-] 0\)/, "(x + 0)"],
];
/** 검사할 부분: 문제 문장만 본다 (해설의 좌표 계산에는 "- 0"이 정상으로 나온다) */
function notationErrors(q) {
  return NOTATION.filter(([re]) => re.test(q)).map(([, why]) => why);
}

let bad = 0;
let checked = 0;
const diversity = [];
const samples = new Map();
const notationSeen = new Set();

// 검사기가 망가지면 조용히 통과하므로 일부러 틀린 식으로 먼저 시험한다
for (const [wrong, why] of [
  ["일차함수 y = 3x + 0 에서 x = 1일 때 y의 값은?", "0인 항"],
  ["일차함수 y = 1x - 2 에서 x = 1일 때 y의 값은?", "계수 1"],
  ["이차함수 y = (x + 0)² + 3 의 꼭짓점의 x좌표는?", "(x + 0)"],
]) {
  if (notationErrors(wrong).length === 0) {
    console.error(`✗ 표기 검사기가 "${why}"를 잡아내지 못합니다: ${wrong}`);
    bad++;
  }
}
for (const ok of ["6.9 + 0.9 = ?", "정비례 관계 y = 2x 에서 x = 3일 때 y의 값은?", "10 + 5 = ?"]) {
  if (notationErrors(ok).length > 0) {
    console.error(`✗ 표기 검사기가 정상 문제를 오탐합니다: ${ok}`);
    bad++;
  }
}

for (let grade = 1; grade <= 9; grade++) {
  // 1) 하루 최대 설정치가 서로 겹치지 않아야 한다
  const daily = (await get(`${BASE}/api/dev/mathgen?grade=${grade}&n=30`)).problems;
  const uniq = new Set(daily.map((p) => p.q)).size;
  if (daily.length !== 30 || uniq !== 30) {
    console.error(`✗ ${grade}학년 하루 30문제: ${daily.length}개 생성 / 고유 ${uniq}개`);
    bad++;
  }

  // 2~4) 대량 표본으로 형식·정답 검증
  const problems = (await get(`${BASE}/api/dev/mathgen?grade=${grade}&n=600`)).problems;
  diversity.push({ 학년: grade <= 6 ? `초${grade}` : `중${grade - 6}`, "서로 다른 문제 상한(약)": problems.length });

  for (const p of problems) {
    if (p.type === "mc") {
      if (
        !Array.isArray(p.choices) ||
        p.choices.length !== 4 ||
        new Set(p.choices).size !== 4 ||
        !Number.isInteger(p.answer) ||
        p.answer < 0 ||
        p.answer > 3
      ) {
        console.error(`✗ ${grade}학년 mc 형식: ${p.q} / ${JSON.stringify(p.choices)} / ${p.answer}`);
        bad++;
      }
    } else if (
      !Array.isArray(p.answer) ||
      p.answer.length === 0 ||
      p.answer.some((a) => !String(a).trim())
    ) {
      console.error(`✗ ${grade}학년 short answer: ${p.q} → ${JSON.stringify(p.answer)}`);
      bad++;
    }

    for (const why of notationErrors(p.q)) {
      const key = `${grade}|${why}|${p.tag}`;
      if (!notationSeen.has(key)) {
        notationSeen.add(key);
        console.error(`✗ ${grade}학년 ${why}: ${p.q.replace(/\n/g, " / ")}`);
        bad++;
      }
    }

    const expected = evalExpr(p.q.split("\n")[0]);
    if (expected !== null && p.type === "short") {
      checked++;
      const got = answerValue(p);
      if (got === null || Math.abs(got - expected) > 1e-9) {
        console.error(`✗ ${grade}학년 정답 불일치: "${p.q}" 정답=${JSON.stringify(p.answer)} 실제계산=${expected}`);
        bad++;
      }
    } else {
      const key = `${grade <= 6 ? "초" + grade : "중" + (grade - 6)} · ${p.tag}`;
      if (!samples.has(key))
        samples.set(key, `${p.q.replace(/\n/g, " / ")}  →  ${p.type === "mc" ? p.choices[p.answer] : p.answer.join(" | ")}`);
    }
  }
}

console.log(`\n계산식 독립 검증: ${checked}건`);
console.table(diversity);
console.log("--- 문장형 문제 유형별 표본 (눈으로 확인) ---");
for (const [k, v] of [...samples].sort()) console.log(`[${k}] ${v}`);

if (bad > 0) {
  console.error(`\n❌ 오류 ${bad}건`);
  process.exit(1);
}
console.log("\n✅ 수학 생성기 검사 통과");
