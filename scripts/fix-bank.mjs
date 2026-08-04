// 문제은행 정리: 중복 문구 구분 + 허용 정답 중복 제거
// 실행: node scripts/fix-bank.mjs
import { readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "data", "problems");

// 같은 파일 안에서 질문 문구가 겹친 문제들 — 난이도는 그대로 두고 문구만 다르게
const RESTEM = {
  "ko1-022": "다음 중 바르게 쓴 문장을 고르세요.",
  "ko3-022": "높임 표현이 알맞은 문장을 고르세요.",
  "ko4-003": "맞춤법이 바르게 쓰인 문장을 고르세요.",
  "ko5-003": "맞춤법이 알맞은 문장을 고르세요.",
  "ko5-008": "띄어쓰기가 알맞은 문장을 고르세요.",
  "ko5-009": "띄어쓰기를 바르게 한 문장을 고르세요.",
};

const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, "");

let restemmed = 0;
let deduped = 0;
let filesChanged = 0;

for (const sub of readdirSync(ROOT)) {
  for (const file of readdirSync(path.join(ROOT, sub))) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(ROOT, sub, file);
    const arr = JSON.parse(readFileSync(full, "utf8"));
    let changed = false;

    for (const p of arr) {
      if (RESTEM[p.id]) {
        p.q = RESTEM[p.id];
        restemmed++;
        changed = true;
      }
      if (p.type === "short" && Array.isArray(p.answer)) {
        const seen = new Set();
        const kept = p.answer.filter((a) => {
          const k = norm(a);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (kept.length !== p.answer.length) {
          deduped += p.answer.length - kept.length;
          p.answer = kept;
          changed = true;
        }
      }
    }

    if (changed) {
      writeFileSync(full, JSON.stringify(arr, null, 2) + "\n", "utf8");
      filesChanged++;
    }
  }
}

console.log(`문구 구분: ${restemmed}건 · 중복 정답 제거: ${deduped}건 · 수정된 파일: ${filesChanged}개`);
