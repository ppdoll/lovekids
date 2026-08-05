/**
 * 채점 검증.
 *
 * 아이가 답을 알고 썼는데 오답으로 처리되면 억울해하고 앱을 믿지 않는다.
 * 반대로 틀린 답을 정답으로 봐주면 학습이 안 된다.
 * 그래서 "맞다고 봐줘야 하는 것"과 "틀리다고 해야 하는 것"을 둘 다 검사한다.
 *
 * 사전 준비: 개발 서버(npm run dev) 실행
 * 실행: node scripts/test-grading.mjs [베이스URL]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

let failed = 0;

/** [정답 목록, 아이가 쓴 답, 정답이어야 하는가, 설명] */
const CASES = [
  // ── 숫자 ──
  [["8"], "8", true, "숫자 그대로"],
  [["8"], " 8 ", true, "앞뒤 공백"],
  [["8"], "9", false, "다른 숫자"],
  [["-3"], "-3", true, "음수"],
  [["-3"], "3", false, "부호가 다르면 오답"],
  [["13.6"], "13.6", true, "소수"],
  [["13.6"], "13.60", true, "소수 뒤 0"],
  [["3.14"], "314", false, "소수점을 빼면 다른 값 (마침표 처리가 소수를 망치지 않아야 한다)"],
  [["1200"], "1,200", true, "천 단위 쉼표"],

  // ── 단위 ──
  [["325", "325장"], "325장", true, "단위를 붙여 씀"],
  [["325", "325장"], "325", true, "단위 없이 씀"],
  [["5", "5마리", "다섯", "다섯 마리"], "다섯마리", true, "허용 정답의 띄어쓰기 변형"],

  // ── 분수 ──
  [["1/2"], "1/2", true, "분수"],
  [["1/2"], "3/6", true, "약분하면 같은 분수"],
  [["1/2"], "0.5", true, "분수와 같은 값의 소수"],
  [["1/2"], "2/1", false, "분자와 분모를 뒤집으면 오답"],
  [["4/12", "1/3"], "1/3", true, "약분한 형태"],

  // ── 영어 ──
  [["cat"], "Cat", true, "첫 글자 대문자"],
  [["cat"], "CAT", true, "모두 대문자"],
  [["are"], "are", true, "그대로"],
  [["are"], "is", false, "다른 단어"],
  [["to go"], "to go", true, "두 단어"],
  [["to go"], "togo", true, "띄어쓰기 없이"],
  [["most popular"], "Most Popular", true, "대문자 + 띄어쓰기"],

  // ── 문장형 (마침표·따옴표를 잊어도 정답이어야 한다) ──
  [["This is my bag."], "This is my bag", true, "문장 끝 마침표 생략"],
  [["This is my bag."], "this is my bag.", true, "소문자로 씀"],
  [["This is my bag."], "This is my bag!", true, "마침표 대신 느낌표"],
  [["나는 딸기를 먹어요."], "나는 딸기를 먹어요", true, "한국어 문장, 마침표 생략"],
  [["나는 딸기를 먹어요."], "나는딸기를먹어요", true, "붙여 씀"],
  [["안녕하세요"], "안녕하세요!", true, "느낌표를 덧붙임"],
  [["다의어"], "\"다의어\"", true, "따옴표를 붙임"],
  [["This is my bag."], "This is my hat.", false, "낱말이 다르면 오답"],

  // ── 한국어 낱말 ──
  [["역설"], "역설", true, "그대로"],
  [["역설"], " 역설 ", true, "앞뒤 공백"],
  [["역설"], "반어", false, "다른 개념"],
  [["구개음화"], "구개음화", true, "그대로"],
  [["서론", "머리말"], "머리말", true, "허용 정답 중 두 번째"],

  // ── 빈 답 ──
  [["8"], "", false, "빈 답은 오답"],
  [["8"], "   ", false, "공백만 있어도 오답"],
];

const res = await fetch(`${BASE}/api/dev/grade`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cases: CASES.map(([answer, given]) => ({ answer, given, type: "short" })),
  }),
});
if (!res.ok) {
  console.error(`✗ 채점 API 호출 실패 (HTTP ${res.status}) — 개발 서버가 켜져 있나요? npm run dev`);
  process.exit(1);
}
const { results } = await res.json();

console.log("=== 단답형 채점 ===");
CASES.forEach(([answer, given, want, note], i) => {
  const got = results[i].correct;
  const ok = got === want;
  if (!ok) failed++;
  const shown = given === "" ? "(빈 답)" : given.trim() === "" ? "(공백)" : `"${given}"`;
  console.log(
    `${ok ? "✓" : "✗"} ${note} — 정답 ${JSON.stringify(answer)} vs ${shown} → ${got ? "정답" : "오답"}` +
      (ok ? "" : `  (기대: ${want ? "정답" : "오답"})`),
  );
});

/* ── 객관식 ── */
console.log("\n=== 객관식 채점 ===");
const MC = [
  [0, "0", true, "정답 보기를 고름"],
  [0, "1", false, "다른 보기를 고름"],
  [3, "3", true, "마지막 보기가 정답"],
  [3, "0", false, "첫 보기를 고름"],
];
const mcRes = await fetch(`${BASE}/api/dev/grade`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cases: MC.map(([answer, given]) => ({ answer, given, type: "mc" })) }),
});
const mc = (await mcRes.json()).results;
MC.forEach(([answer, given, want, note], i) => {
  const got = mc[i].correct;
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${note} — 정답 인덱스 ${answer} vs "${given}" → ${got ? "정답" : "오답"}`);
});

console.log(
  failed === 0 ? `\n✅ 채점 검사 통과 (${CASES.length + MC.length}가지)` : `\n❌ 실패 ${failed}건`,
);
process.exit(failed === 0 ? 0 : 1);
