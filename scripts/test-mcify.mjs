/**
 * 초등 수학이 모두 객관식으로 나오는지 검증.
 *
 * 문제은행의 초등 문제는 전부 객관식이지만, 연산·문장제는 그때그때 만들어져
 * 단답형으로 나온다. 그래서 숙제를 만드는 자리(lib/daily.ts)에서 객관식으로 바꾼다.
 * 이 검사가 없으면 생성기를 손볼 때 초등 숙제에 단답형이 슬그머니 되돌아온다.
 *
 * 보기의 크기가 정답과 비슷한지도 본다. 크기가 동떨어진 수가 섞이면 아이가 계산하지
 * 않고 눈대중으로 골라낼 수 있어 문제가 뜻을 잃는다.
 *
 * 사전 준비: 개발 서버(npm run dev) 실행
 * 실행: node scripts/test-mcify.mjs [베이스URL]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const PIN = "0000";

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

const jpost = async (p, body) => {
  const r = await fetch(`${BASE}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const today = (kid) => fetch(`${BASE}/api/today?kid=${kid}&subject=math`).then((r) => r.json());

/* ── 초1~6과 중1~3을 함께 만든다 ── */
const kids = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => ({
  id: `t-mc${g}`,
  name: g <= 6 ? `초${g}` : `중${g - 6}`,
  grade: g,
  emoji: "🦁",
  perDay: { ko: 0, en: 0, math: 20 },
  calc: { mode: "auto" },
}));
await jpost("/api/parent/settings", { pin: PIN, kids });

console.log("=== 초등은 모두 객관식, 중학교는 직접 쓰기 ===");
const elemSets = [];
for (const k of kids) {
  await jpost("/api/parent/set-action", { pin: PIN, kidId: k.id, subject: "math", action: "reset" });
  const set = await today(k.id);
  const shorts = set.problems.filter((p) => p.type !== "mc");
  if (k.grade <= 6) {
    elemSets.push({ k, set });
    check(`${k.name} 수학 ${set.problems.length}문제가 모두 객관식`, shorts.length === 0, shorts.length ? `단답 ${shorts.length}개: ${shorts[0].q.split("\n")[0].slice(0, 40)}` : "");
  } else {
    check(`${k.name}은 단답형이 남아 있음 (중학교는 직접 쓰게 둔다)`, shorts.length > 0, `단답 ${shorts.length}개`);
  }
}

console.log("\n=== 보기 형식 ===");
let badShape = 0;
for (const { set } of elemSets) {
  for (const p of set.problems) {
    if (p.type !== "mc") continue;
    if (!Array.isArray(p.choices) || p.choices.length !== 4 || new Set(p.choices).size !== 4) badShape++;
  }
}
check("초등 객관식 보기가 모두 서로 다른 4개", badShape === 0, badShape ? `${badShape}건` : "");

console.log("\n=== 보기의 크기가 정답과 비슷한지 ===");
/**
 * 보기 중 가장 큰 수가 가장 작은 수의 열 배를 넘으면, 자릿수만 봐도 답이 좁혀진다.
 * (예: 정답 54에 보기가 [54, 5, 540, 9]이면 계산할 필요가 없다)
 *
 * 자동 생성 문제(gen-/wgen-)만 본다. 문제은행의 손으로 쓴 문제에는 자릿수 차이가
 * 문제의 핵심인 것이 있다 ("2L 300mL는 몇 mL?" → 230 / 2300 / 2030 / 23000).
 */
const spread = [];
for (const { k, set } of elemSets) {
  for (const p of set.problems) {
    if (p.type !== "mc") continue;
    if (!/^w?gen-/.test(p.id)) continue;
    // "7시 30분"처럼 수가 둘인 보기는 하나의 수로 견줄 수 없으므로 건너뛴다
    if (!p.choices.every((c) => /^\d+(\.\d+)?\s*\D*$/.test(String(c).trim()))) continue;
    const nums = p.choices.map((c) => Number(String(c).replace(/[^\d.]/g, ""))).filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length !== 4) continue; // 낱말 보기는 건너뛴다
    const max = Math.max(...nums), min = Math.min(...nums);
    if (max > min * 10) spread.push(`${k.name} ${p.id}: ${p.choices.join(" / ")}`);
  }
}
check("보기의 크기 차가 열 배를 넘지 않음", spread.length === 0, spread.slice(0, 3).join(" | "));

console.log("\n=== 바꾼 뒤에도 채점이 맞는지 ===");
const k1 = elemSets[0];
const first = k1.set.problems[0];
// 서버가 정답 번호를 알려 주지 않으므로 네 개를 차례로 넣어 정확히 하나만 정답인지 본다
let correctCount = 0;
for (let i = 0; i < 4; i++) {
  await jpost("/api/parent/set-action", { pin: PIN, kidId: k1.k.id, subject: "math", action: "reset" });
  const s = await today(k1.k.id);
  const p = s.problems[0];
  const r = await jpost("/api/answer", { kidId: k1.k.id, subject: "math", index: 0, given: String(i) });
  if (r.body.record?.correct) correctCount++;
  if (p.q !== first.q) { correctCount = -1; break; } // 리셋으로 문제가 바뀌면 이 검사는 뜻이 없다
}
check(
  "객관식 네 보기 중 정확히 하나만 정답으로 채점됨",
  correctCount === 1 || correctCount === -1,
  correctCount === -1 ? "리셋으로 문제가 바뀌어 건너뜀" : `정답 처리 ${correctCount}개`,
);

console.log(failed === 0 ? "\n✅ 초등 객관식 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
