/**
 * 수학 문장제 자동 생성기 검증.
 *
 * 두 가지를 본다.
 *  1) 정답: 문제 문장 안의 숫자로 다시 계산해 정답과 맞는지 (해설의 식을 독립 계산)
 *  2) 한국말: 조사가 받침에 맞게 붙었는지. "지우이는", "사탕를" 같은 어색한 문장이
 *     하나라도 나오면 아이도 부모도 바로 알아챈다.
 *
 * 실행: node scripts/test-wordgen.mjs
 */
import { execSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { pathToFileURL } from "url";

const out = mkdtempSync(path.join(tmpdir(), "wordgen-"));
const tsc = path.join("node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
execSync(
  `"${tsc}" lib/wordgen.ts lib/types.ts --outDir "${out}" --module esnext --target es2020 ` +
    `--moduleResolution bundler --skipLibCheck`,
  { stdio: "inherit" },
);
writeFileSync(path.join(out, "package.json"), '{"type":"module"}');
// tsc는 상대 경로 import에 .js를 붙여주지 않는데, Node의 ESM은 확장자를 요구한다
for (const f of ["wordgen.js", "types.js"]) {
  const p = path.join(out, f);
  writeFileSync(p, readFileSync(p, "utf8").replace(/from "(\.\/[^"]+?)"/g, 'from "$1.js"'));
}
const { genWordProblems, _particles } = await import(pathToFileURL(path.join(out, "wordgen.js")).href);

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

/* ─────────── 1) 조사 처리 ─────────── */
console.log("=== 조사가 받침에 맞게 붙는지 ===");
const cases = [
  ["은는", "사탕", "사탕은"], ["은는", "딸기", "딸기는"],
  ["을를", "구슬", "구슬을"], ["을를", "색종이", "색종이를"],
  ["이가", "연필", "연필이"], ["이가", "귤", "귤이"], ["이가", "카드", "카드가"],
  ["이름은", "서준", "서준이는"], ["이름은", "지우", "지우는"],
  ["이름이", "도현", "도현이가"], ["이름이", "수아", "수아가"],
  ["이름과", "은우", "은우와"], ["이름과", "채원", "채원이와"],
];
let bad = [];
for (const [fn, input, want] of cases) {
  const got = _particles[fn](input);
  if (got !== want) bad.push(`${fn}("${input}") = "${got}" (기대 "${want}")`);
}
check("조사 규칙 12가지", bad.length === 0, bad.join(" / ") || "모두 일치");

/* ─────────── 2) 생성된 문장의 어색한 조사 ─────────── */
console.log("\n=== 생성된 문장에 어색한 조사가 없는지 ===");
const all = [];
for (let g = 1; g <= 9; g++) all.push(...genWordProblems(g, 600).map((p) => ({ g, ...p })));

const hasJong = (w) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return c >= 0 && c <= 11171 ? c % 28 !== 0 : null;
};

/**
 * 문장에 나온 **모든** 낱말 뒤의 조사를 검사한다.
 *
 * 예전에는 검사할 낱말을 여기에 적어두고 그 낱말만 봤는데, 그러면 생성기에 새 낱말을
 * 넣을 때마다 여기에도 적어야 하고, 잊으면 검사가 조용히 새어 나간다.
 * 실제로 "옷차림는 모두 몇 가지인가요?"가 그렇게 통과했다.
 *
 * 대신 "한글 낱말 + 조사 + (공백·문장부호·끝)" 을 전부 찾아 받침과 맞는지 본다.
 * 동사 활용("있는", "나가고")은 조사 뒤에 공백이 오는 형태가 아니거나 받침 규칙에
 * 어긋나지 않아 걸리지 않는다 — 현재 생성 문장 5,400개에서 오탐 0건.
 *
 * "이"는 이름 뒤 접미사이기도 하므로(서준이는) 받침 없는 낱말 뒤에서는 넘어간다.
 */
const RIGHT = { 은: true, 이: true, 을: true, 과: true, 는: false, 가: false, 를: false, 와: false };
function awkwardParticles(sentence) {
  const found = [];
  for (const m of sentence.matchAll(/([가-힣]{2,})(은|는|이|가|을|를|과|와)(?=[\s,.?!)]|$)/g)) {
    const [whole, word, part] = m;
    const j = hasJong(word);
    if (j === null) continue;
    if (RIGHT[part] === j) continue;
    if (!j && part === "이") continue; // "지우이는"이 아니라 "지우이" 형태는 이름 접미사
    found.push(whole);
  }
  return found;
}

// 검사기 자체가 망가지면 조용히 통과하므로, 일부러 틀린 문장으로 먼저 시험한다
check(
  "조사 검사기가 잘못된 조사를 실제로 잡아내는지",
  awkwardParticles("만들 수 있는 옷차림는 모두 몇 가지인가요?").includes("옷차림는") &&
    awkwardParticles("사탕를 3개 먹었습니다.").includes("사탕를") &&
    awkwardParticles("딸기는 몇 개인가요?").length === 0,
);

const awkward = [];
for (const p of all) {
  for (const w of awkwardParticles(p.q)) awkward.push(`[${p.g}학년] "${w}" ← ${p.q.slice(0, 45)}`);
}
check(
  `생성 문장 ${all.length}개의 조사 검사`,
  awkward.length === 0,
  awkward.length ? `어색 ${awkward.length}건: ${[...new Set(awkward)].slice(0, 5).join(" | ")}` : "어색한 조사 없음",
);

/* ─────────── 3) 정답 검증 (해설의 식을 독립 계산) ─────────── */
console.log("\n=== 정답이 맞는지 (해설의 식을 다시 계산) ===");
function evalSimple(expr) {
  // 숫자와 + - × ÷ / 만 허용하고 왼쪽부터 계산 (× ÷ 우선)
  const tokens = expr.trim().split(/\s*([+\-×÷])\s*/).filter((t) => t !== "");
  if (tokens.length % 2 === 0) return null;
  const vals = [], ops = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      const t = tokens[i].replace(/,/g, "");
      const frac = t.match(/^(\d+)\/(\d+)$/);
      const v = frac ? Number(frac[1]) / Number(frac[2]) : Number(t);
      if (!Number.isFinite(v)) return null;
      const op = ops[ops.length - 1];
      if (op === "×" || op === "÷") {
        ops.pop();
        const prev = vals.pop();
        vals.push(op === "×" ? prev * v : prev / v);
      } else vals.push(v);
    } else ops.push(tokens[i]);
  }
  let acc = vals[0];
  for (let i = 0; i < ops.length; i++) acc = ops[i] === "+" ? acc + vals[i + 1] : acc - vals[i + 1];
  return Number.isFinite(acc) ? acc : null;
}

let checkedAns = 0;
const mismatch = [];
for (const p of all) {
  // 나눗셈 나머지 문제는 해설이 "23 ÷ 3 = 7봉지, 나머지 2개" 형태라 등호 좌변만으로 검증할 수 없다.
  // 대신 문제 문장의 두 수로 나머지를 직접 계산해 정답과 비교한다.
  const rem = p.q.match(/(\d+)\S* 한 봉지에 (\d+)/);
  if (rem) {
    checkedAns++;
    const want = Number(rem[1]) % Number(rem[2]);
    const got = Number(String(p.answer[0]).replace(/[^\d.]/g, ""));
    if (want !== got) mismatch.push(`${p.q.slice(0, 45)} | 정답 ${p.answer[0]} | 실제 나머지 ${want}`);
    continue;
  }

  // "연속하는 N개의 자연수의 합" 문제는 해설의 식이 합(21)이고 정답은 가장 작은 수(6)라
  // 등호 양변만으로는 검증할 수 없다. 문제 문장의 수로 직접 계산해 비교한다.
  const seq = p.q.match(/연속하는 (\d+)개의 자연수의 합이 (\d+)/);
  if (seq) {
    checkedAns++;
    const n = Number(seq[1]);
    const sum = Number(seq[2]);
    const want = sum / n - Math.floor(n / 2);
    const got = Number(String(p.answer[0]).replace(/[^\d.\-]/g, ""));
    if (want !== got) mismatch.push(`${p.q.slice(0, 45)} | 정답 ${p.answer[0]} | 실제 ${want}`);
    continue;
  }

  // 해설에 "a op b = c" 형태가 있으면 좌변을 계산해 정답과 비교
  const m = p.explain.match(/([\d\s+\-×÷/,]+)=\s*([\d.]+)/);
  if (!m) continue;
  const left = evalSimple(m[1]);
  if (left === null) continue;
  const declared = Number(m[2]);
  const answer = Number(String(p.answer[0]).replace(/[^\d.]/g, ""));
  checkedAns++;
  if (Math.abs(left - declared) > 1e-9 || Math.abs(declared - answer) > 1e-9) {
    mismatch.push(`${p.q.slice(0, 45)} | 해설 ${m[1].trim()}=${declared} | 정답 ${p.answer[0]} | 계산 ${left}`);
  }
}
check(`해설 식과 정답 대조 ${checkedAns}건`, mismatch.length === 0, mismatch.slice(0, 3).join(" || ") || "모두 일치");

// 답이 정수인지. 음수는 중학교(7~9학년) 정수 단원에서는 정상이지만 초등에서는 나오면 안 된다.
const weird = all.filter((p) => {
  const v = Number(String(p.answer[0]).replace(/[^\d.\-]/g, ""));
  if (!Number.isFinite(v) || !Number.isInteger(v)) return true;
  return v < 0 && p.g <= 6;
});
check(
  "답이 정수이고, 초등에는 음수 답이 없음",
  weird.length === 0,
  weird.slice(0, 3).map((p) => `${p.g}학년 ${p.q.slice(0, 40)} → ${p.answer[0]}`).join(" | ") || "",
);

/* ─────────── 4) 다양성 ─────────── */
console.log("\n=== 만들 수 있는 서로 다른 문장제 수 ===");
for (let g = 1; g <= 9; g++) {
  const seen = new Set();
  for (let i = 0; i < 4000; i++) for (const p of genWordProblems(g, 1)) seen.add(p.q);
  console.log(`  ${g}학년: ${seen.size.toLocaleString()}개`);
}
const daily = genWordProblems(3, 20);
check("하루치(20개) 요청 시 서로 겹치지 않음", new Set(daily.map((p) => p.q)).size === daily.length, `${daily.length}개`);

console.log("\n--- 학년별 표본 ---");
for (const g of [1, 3, 6]) {
  const s = genWordProblems(g, 2);
  for (const p of s) console.log(`[${g}학년] ${p.q}\n     → ${p.answer.join(" | ")}  (${p.explain})`);
}

console.log(failed === 0 ? "\n✅ 문장제 생성기 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
