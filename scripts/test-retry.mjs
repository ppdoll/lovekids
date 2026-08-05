/**
 * "틀린 문제 다시 풀기" 검증.
 *
 * 이 기능에서 잘못되면 가장 아픈 것은 **첫 시도 기록이 덮어써지는 것**이다.
 * 다시 풀어 맞힌 것을 처음부터 맞힌 것처럼 바꿔 버리면, 부모가 보는 점수·달력·연속 달성이
 * 사실과 달라지고 아이가 어디를 모르는지 알 수 없게 된다. 그래서 그 부분을 집중해서 본다.
 *
 *  1) 틀린 문제만 다시 풀기 대상이 되는지 (맞힌 문제·안 푼 문제는 거부)
 *  2) 다시 풀어 맞혀도 첫 시도 기록·점수·완료 시각·최고 콤보·달력이 그대로인지
 *  3) 다시 풀어 맞히면 남은 개수가 줄고, 또 틀리면 그대로 남는지
 *  4) 부모 오답 노트에 "다시 풀어서 맞혔어요" 표시가 붙는지
 *  5) 남의 아이 것을 다시 풀 수 없는지 (아이 세션 권한)
 *
 * 사전 준비: 개발 서버(npm run dev) 실행
 * 실행: node scripts/test-retry.mjs [베이스URL]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const PIN = "0000";

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

const jget = async (p) => (await fetch(`${BASE}${p}`)).json();
const jpost = async (p, body) => {
  const r = await fetch(`${BASE}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const parentData = async () =>
  (await fetch(`${BASE}/api/parent/data`, { headers: { "x-pin": PIN } })).json();

const KID = "t-retry";

/* ── 준비: 답을 예측할 수 있게 두 자리 덧셈만 내는 아이 ── */
await jpost("/api/parent/settings", {
  pin: PIN,
  kids: [
    {
      id: KID,
      name: "다시풀기",
      grade: 3,
      emoji: "🐰",
      perDay: { ko: 0, en: 0, math: 5 },
      calc: {
        mode: "custom",
        includeWord: false,
        add: { on: true, digits: 2, carry: true },
        sub: { on: false, digits: 2, borrow: false },
        mul: { on: false, tables: [] },
        div: { on: false, remainder: false },
      },
    },
  ],
});
await jpost("/api/parent/set-action", { pin: PIN, kidId: KID, subject: "math", action: "reset" });

// 오답 노트는 리셋해도 일부러 남기므로(배운 기록) 여러 번 돌리면 쌓인다.
// 절대 개수가 아니라 이번 실행에서 늘어난 것만 검사한다.
const wrongAtStart = (await parentData()).kids.find((k) => k.id === KID)?.wrong.length ?? 0;

const solve = (q) => {
  const m = q.match(/^(\d+) \+ (\d+) = \?$/);
  return m ? Number(m[1]) + Number(m[2]) : null;
};
const answer = (i, given) => jpost("/api/answer", { kidId: KID, subject: "math", index: i, given: String(given) });
const retry = (i, given) => jpost("/api/retry", { kidId: KID, subject: "math", index: i, given: String(given) });
const today = () => jget(`/api/today?kid=${KID}&subject=math`);
const state = async () => (await jget("/api/state")).kids.find((k) => k.id === KID);

let set = await today();
const answers = set.problems.map((p) => solve(p.q));
check(
  "준비: 두 자리 덧셈 5문제",
  set.problems.length === 5 && answers.every((a) => a !== null),
  set.problems.map((p) => p.q).join(" / "),
);

/* ── 1) 다 풀기: 0·2번은 일부러 틀리고 나머지는 맞힌다 ── */
console.log("\n=== 다 풀기 (0번·2번 일부러 오답) ===");
const WRONG = [0, 2];
for (let i = 0; i < 5; i++) {
  await answer(i, WRONG.includes(i) ? answers[i] + 1 : answers[i]);
}
set = await today();
const firstTry = set.answers.map((a) => a.correct);
check("첫 시도 채점 결과", JSON.stringify(firstTry) === JSON.stringify([false, true, false, true, true]));
check("완료 처리됨", !!set.completedAt);
const firstCompletedAt = set.completedAt;
const firstBestCombo = set.bestCombo;
const firstGiven = set.answers.map((a) => a.given);

let st = await state();
check("과목 현황: 3/5 정답", st.today.math.correct === 3 && st.today.math.total === 5);
check("다시 풀 문제 2개로 잡힘", st.today.math.wrongTotal === 2 && st.today.math.retryLeft === 2);

const histBefore = (await parentData()).kids.find((k) => k.id === KID)?.history;

/* ── 2) 맞힌 문제·안 푼 문제는 다시 풀기 대상이 아니다 ── */
console.log("\n=== 대상이 아닌 문제는 거부 ===");
const okRes = await retry(1, answers[1]);
check("맞힌 문제 다시 풀기 거부", okRes.status === 400 && okRes.body.error === "not-wrong", JSON.stringify(okRes.body));
const oobRes = await retry(99, "1");
check("없는 번호 거부", oobRes.status === 400 && oobRes.body.error === "bad-index");

/* ── 3) 틀린 문제를 다시 풀어 맞힌다 ── */
console.log("\n=== 다시 풀어 맞히기 ===");
const r0 = await retry(0, answers[0]);
check("정답으로 채점됨", r0.body.record?.correct === true, JSON.stringify(r0.body.record));
check("남은 수 1개로 줄어듦", r0.body.left === 1 && r0.body.fixed === 1, JSON.stringify(r0.body));

set = await today();
check(
  "첫 시도 기록은 그대로 (아직 오답으로 남아 있어야 한다)",
  set.answers[0].correct === false && set.answers[0].given === firstGiven[0],
  `correct=${set.answers[0].correct} given=${set.answers[0].given}`,
);
check("다시 풀기 기록이 따로 저장됨", set.retry?.["0"]?.correct === true);
check("완료 시각 그대로", set.completedAt === firstCompletedAt);
check("최고 콤보 그대로", set.bestCombo === firstBestCombo);

st = await state();
check("점수는 여전히 3/5", st.today.math.correct === 3, `${st.today.math.correct}/5`);
check("남은 다시 풀기 1개", st.today.math.wrongTotal === 2 && st.today.math.retryLeft === 1);

const histAfter = (await parentData()).kids.find((k) => k.id === KID)?.history;
check("달력 기록 변화 없음", JSON.stringify(histBefore) === JSON.stringify(histAfter));

/* ── 4) 다시 풀다 또 틀리면 남아 있어야 한다 ── */
console.log("\n=== 다시 풀다 또 틀리면 남는다 ===");
const r2bad = await retry(2, answers[2] + 5);
check("오답으로 채점됨", r2bad.body.record?.correct === false);
check("남은 수 그대로 1개", r2bad.body.left === 1, JSON.stringify(r2bad.body));
st = await state();
check("현황에도 1개 남음", st.today.math.retryLeft === 1);

const r2ok = await retry(2, answers[2]);
check("다시 시도해서 맞히면 0개", r2ok.body.left === 0 && r2ok.body.fixed === 2, JSON.stringify(r2ok.body));
st = await state();
check("현황도 0개 (전부 고침)", st.today.math.wrongTotal === 2 && st.today.math.retryLeft === 0);

/* ── 한 번 고친 문제는 다시 열리지 않는다 (고친 개수가 줄어들면 아이가 헷갈린다) ── */
const again = await retry(0, answers[0] + 7);
check("고친 문제 재제출 거부", again.status === 400 && again.body.error === "already-fixed", JSON.stringify(again.body));
st = await state();
check("거부 후에도 0개 유지", st.today.math.retryLeft === 0);

/* ── 5) 오답 노트 표시 ── */
console.log("\n=== 부모 오답 노트 표시 ===");
const wrong = (await parentData()).kids.find((k) => k.id === KID)?.wrong ?? [];
// /api/parent/data는 최신순으로 뒤집어 내려주므로 이번에 쌓인 것이 앞에 온다
const mine = wrong.slice(0, wrong.length - wrongAtStart);
check("오답 노트에 이번 오답 2개가 쌓임", mine.length === 2, `${mine.length}개 (시작 ${wrongAtStart}개)`);
check(
  "둘 다 고쳤다고 표시됨",
  mine.length === 2 && mine.every((w) => !!w.fixedAt),
  JSON.stringify(mine.map((w) => w.fixedAt)),
);
check(
  "오답 노트의 문제가 실제 틀린 문제와 같음",
  mine.length === 2 && mine.some((w) => w.q === set.problems[0].q) && mine.some((w) => w.q === set.problems[2].q),
);

/* ── 6) 아이 세션은 남의 문제를 다시 풀 수 없다 ── */
console.log("\n=== 다른 아이 것은 못 건드린다 ===");
const link = await jpost("/api/parent/kid-link", { pin: PIN, kidId: KID, action: "issue" });
const token = link.body?.token;
if (!token) {
  check("아이 접속 링크 발급", false, JSON.stringify(link.body));
} else {
  // 아이 링크로 들어가 세션 쿠키를 받는다
  const jar = new Map();
  const enter = await fetch(`${BASE}/k/${token}`, { redirect: "manual" });
  for (const c of enter.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(";");
    const eq = kv.indexOf("=");
    jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
  }
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  check("아이 세션 쿠키 받음", jar.size > 0);

  const asKid = async (kidId) => {
    const r = await fetch(`${BASE}/api/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ kidId, subject: "math", index: 0, given: "1" }),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const other = await asKid("someone-else");
  check("남의 kidId는 403", other.status === 403, `${other.status} ${JSON.stringify(other.body)}`);
  const self = await asKid(KID);
  // 자기 것이면 권한 검사를 통과해 채점 단계까지 간다.
  // (이미 다 고쳐 놓았으므로 결과는 already-fixed. 403이 아니면 권한은 통과한 것)
  check("자기 것은 권한 통과", self.status !== 403 && self.body.error === "already-fixed", `${self.status} ${JSON.stringify(self.body)}`);
}

console.log(failed === 0 ? "\n✅ 다시 풀기 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
