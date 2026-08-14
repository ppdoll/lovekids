/**
 * 부모의 "다시 시작"(리셋) / "문제 더 내기" 그리고 콤보 계산 검증.
 *
 * 기록이 남는 기능이라 눈으로 확인하기 어려운 실수가 생기기 쉽다.
 *  - 리셋하면 완료 기록·달력도 같이 내려가는지
 *  - 문제를 더 내면 완료 상태가 풀리고, 오답 노트가 중복으로 쌓이지 않는지
 *  - 콤보가 연속 정답에서만 올라가고 틀리면 0으로 돌아가는지
 *  - 새로고침해도 콤보가 이어지는지
 *
 * 사전 준비: 개발 서버(npm run dev) 실행
 * 실행: node scripts/test-parent-actions.mjs [베이스URL]
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

/* ── 준비: 수학만 하는 아이 하나. 답을 예측할 수 있도록 연산만 출제 ── */
await jpost("/api/parent/settings", {
  pin: PIN,
  kids: [
    {
      id: "t-action",
      name: "테스트",
      grade: 3,
      emoji: "🐻",
      perDay: { ko: 0, en: 0, math: 6 },
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

const KID = "t-action";
const solve = (q) => {
  const m = q.match(/^(\d+) \+ (\d+) = \?$/);
  return m ? Number(m[1]) + Number(m[2]) : null;
};
const answer = (i, given) => jpost("/api/answer", { kidId: KID, subject: "math", index: i, given: String(given) });
/**
 * 계산한 값을 그 문제에 맞는 제출값으로 바꾼다.
 *
 * 초등 문제는 모두 객관식이라(lib/daily.ts의 toMultipleChoice) 답을 숫자로 보내면 안 되고
 * 보기 번호를 보내야 한다. 이 도우미가 없으면 초등 객관식 전환에 이 검사가 함께 깨진다.
 */
const submitFor = (p, value) => {
  if (p.type !== "mc") return String(value);
  const i = p.choices.findIndex((c) => Number(String(c).replace(/[^\d.-]/g, "")) === value);
  if (i < 0) throw new Error(`보기에서 ${value}를 찾을 수 없음: ${JSON.stringify(p.choices)}`);
  return String(i);
};
/** 일부러 틀리게 답할 때 쓰는 값 (객관식이면 정답이 아닌 보기 번호) */
const wrongFor = (p, value) => {
  if (p.type !== "mc") return String(value + 1);
  const right = Number(submitFor(p, value));
  return String((right + 1) % 4);
};


/* ── 콤보 ── */
console.log("=== 콤보 ===");
await jpost("/api/parent/set-action", { pin: PIN, kidId: KID, subject: "math", action: "reset" });

// 오답 노트는 리셋해도 일부러 남기므로(배운 기록), 여러 번 돌리면 쌓인다.
// 절대 개수가 아니라 이번 실행에서 늘어난 양으로 검사한다.
const wrongAtStart = (await parentData()).kids.find((k) => k.id === KID)?.wrong.length ?? 0;
let set = await jget(`/api/today?kid=${KID}&subject=math`);
check("리셋 직후 콤보는 0", set.combo === 0 && set.bestCombo === 0, `combo=${set.combo}, best=${set.bestCombo}`);

let r = await answer(0, submitFor(set.problems[0], solve(set.problems[0].q)));
check("1문제 정답 → 콤보 1", r.body.combo === 1, `combo=${r.body.combo}`);
r = await answer(1, submitFor(set.problems[1], solve(set.problems[1].q)));
check("2문제 연속 정답 → 콤보 2", r.body.combo === 2, `combo=${r.body.combo}`);
r = await answer(2, submitFor(set.problems[2], solve(set.problems[2].q)));
check("3문제 연속 정답 → 콤보 3", r.body.combo === 3, `combo=${r.body.combo}`);

// 새로고침해도 콤보 유지
set = await jget(`/api/today?kid=${KID}&subject=math`);
check("새로고침해도 콤보 이어짐", set.combo === 3, `combo=${set.combo}`);

// 일부러 오답 → 콤보 끊김, 최고 기록은 남음
r = await answer(3, wrongFor(set.problems[3], solve(set.problems[3].q)));
check("틀리면 콤보 0으로", r.body.combo === 0, `combo=${r.body.combo}`);
check("최고 콤보는 3으로 유지", r.body.bestCombo === 3, `best=${r.body.bestCombo}`);

// 다시 쌓기
r = await answer(4, submitFor(set.problems[4], solve(set.problems[4].q)));
check("다시 맞히면 콤보 1부터", r.body.combo === 1, `combo=${r.body.combo}`);

/* ── 문제 더 내기 ── */
console.log("\n=== 문제 더 내기 ===");
// 마지막 문제까지 풀어 완료 상태 만들기
r = await answer(5, submitFor(set.problems[5], solve(set.problems[5].q)));
check("6문제 모두 풀어 완료됨", r.body.done === true, `done=${r.body.done}`);

let pd = await parentData();
let kid = pd.kids.find((k) => k.id === KID);
check("완료 기록이 달력에 남음", !!kid.history[pd.date]?.math?.done, JSON.stringify(kid.history[pd.date] ?? {}));
const wrongBefore = kid.wrong.length;
check(
  "오답 1건이 오답 노트에 추가됨",
  wrongBefore === wrongAtStart + 1,
  `시작 ${wrongAtStart}건 → 현재 ${wrongBefore}건`,
);

const add = await jpost("/api/parent/set-action", { pin: PIN, kidId: KID, subject: "math", action: "add", count: 3 });
check("3문제 추가 성공", add.status === 200 && add.body.added === 3, JSON.stringify(add.body));

set = await jget(`/api/today?kid=${KID}&subject=math`);
check("총 문제가 6 → 9로 늘어남", set.total === 9, `total=${set.total}`);
check("추가된 문제는 아직 안 푼 상태", set.answers.slice(6).every((a) => a === null), "");
check("완료 상태가 풀림", set.completedAt === null, `completedAt=${set.completedAt}`);
check("이미 푼 6문제의 채점 결과는 그대로", set.answers.slice(0, 6).every((a) => a !== null), "");
check("추가된 문제도 설정대로(두 자리 덧셈)", set.problems.slice(6).every((p) => /^\d\d \+ \d\d = \?$/.test(p.q)),
  set.problems.slice(6).map((p) => p.q).join(" / "));

pd = await parentData();
kid = pd.kids.find((k) => k.id === KID);
check("완료 기록이 내려감 (다 풀 때까지)", !kid.history[pd.date]?.math?.done, JSON.stringify(kid.history[pd.date] ?? {}));

// 추가된 3문제 풀어서 다시 완료
for (let i = 6; i < 9; i++) await answer(i, submitFor(set.problems[i], solve(set.problems[i].q)));
pd = await parentData();
kid = pd.kids.find((k) => k.id === KID);
check("다시 완료 처리됨", !!kid.history[pd.date]?.math?.done, JSON.stringify(kid.history[pd.date] ?? {}));
check(
  "오답 노트가 중복으로 쌓이지 않음",
  kid.wrong.length === wrongBefore,
  `이전 ${wrongBefore}건 → 현재 ${kid.wrong.length}건`,
);
check("완료 기록의 점수가 9문제 기준으로 갱신됨", kid.history[pd.date].math.total === 9,
  JSON.stringify(kid.history[pd.date].math));

/* ── 리셋 ── */
console.log("\n=== 다시 시작 (리셋) ===");
const before = (await jget(`/api/today?kid=${KID}&subject=math`)).problems.map((p) => p.q).join("|");
const rst = await jpost("/api/parent/set-action", { pin: PIN, kidId: KID, subject: "math", action: "reset" });
check("리셋 성공", rst.status === 200, JSON.stringify(rst.body));

set = await jget(`/api/today?kid=${KID}&subject=math`);
check("문제 수가 설정값(6)으로 돌아감", set.total === 6, `total=${set.total}`);
check("모두 안 푼 상태", set.answers.every((a) => a === null), "");
check("새 문제로 바뀜", before !== set.problems.map((p) => p.q).join("|"), "");

pd = await parentData();
kid = pd.kids.find((k) => k.id === KID);
check("달력의 완료 기록도 지워짐", !kid.history[pd.date]?.math, JSON.stringify(kid.history[pd.date] ?? {}));
check("오답 노트는 남아 있음 (배운 기록)", kid.wrong.length === wrongBefore, `${kid.wrong.length}건`);

/* ── 권한 ── */
console.log("\n=== 권한 ===");
const badPin = await jpost("/api/parent/set-action", { pin: "9999", kidId: KID, subject: "math", action: "reset" });
check("PIN이 틀리면 거부", badPin.status === 403, `HTTP ${badPin.status}`);
const badKid = await jpost("/api/parent/set-action", { pin: PIN, kidId: "없는아이", subject: "math", action: "reset" });
check("없는 아이는 거부", badKid.status === 404, `HTTP ${badKid.status}`);
const badAct = await jpost("/api/parent/set-action", { pin: PIN, kidId: KID, subject: "math", action: "delete" });
check("이상한 동작은 거부", badAct.status === 400, `HTTP ${badAct.status}`);
const bigAdd = await jpost("/api/parent/set-action", { pin: PIN, kidId: KID, subject: "math", action: "add", count: 9999 });
check("추가 개수는 20개로 제한", bigAdd.status === 200 && bigAdd.body.added <= 20, `added=${bigAdd.body.added}`);

/* ── 안 켠 과목 ── */
console.log("\n=== 끄놓은 과목 ===");
const offAdd = await jpost("/api/parent/set-action", { pin: PIN, kidId: KID, subject: "ko", action: "add", count: 3 });
check("과목을 껐으면 문제 추가 거부", offAdd.status >= 400, `HTTP ${offAdd.status} ${JSON.stringify(offAdd.body)}`);

console.log(failed === 0 ? "\n✅ 부모 기능 · 콤보 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
