// 문제은행 무결성 검사: node scripts/validate-bank.mjs
import { readFileSync, readdirSync } from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "data", "problems");
const SUBJECTS = ["ko", "en", "math"];
const LEVELS = new Set(["easy", "normal", "hard"]);
const TAGS = new Map();

let errors = 0;
const rows = [];

for (const sub of SUBJECTS) {
  for (const file of readdirSync(path.join(ROOT, sub)).sort()) {
    if (!file.endsWith(".json")) continue;
    const rel = `${sub}/${file}`;
    const full = path.join(ROOT, sub, file);
    const fail = (msg) => {
      console.error(`  ✗ ${rel}: ${msg}`);
      errors++;
    };

    let arr;
    try {
      const raw = readFileSync(full, "utf8");
      if (raw.charCodeAt(0) === 0xfeff) fail("BOM이 있습니다 (UTF-8 without BOM으로 저장하세요)");
      arr = JSON.parse(raw.replace(/^﻿/, ""));
    } catch (e) {
      fail(`JSON 파싱 실패 — ${e.message}`);
      continue;
    }
    if (!Array.isArray(arr)) {
      fail("최상위가 배열이 아닙니다");
      continue;
    }

    const ids = new Set();
    const qs = new Set();
    let mc = 0,
      short = 0;
    const levelCount = { easy: 0, normal: 0, hard: 0 };

    arr.forEach((p, i) => {
      const at = `#${i + 1}(${p?.id ?? "no-id"})`;
      if (!p || typeof p !== "object") return fail(`${at} 객체가 아닙니다`);
      if (typeof p.id !== "string" || !p.id) fail(`${at} id 누락`);
      else if (ids.has(p.id)) fail(`${at} id 중복`);
      else ids.add(p.id);

      if (typeof p.q !== "string" || !p.q.trim()) fail(`${at} q 누락`);
      else if (qs.has(p.q.trim())) fail(`${at} 문제 텍스트 중복`);
      else qs.add(p.q.trim());

      if (p.type === "mc") {
        mc++;
        if (!Array.isArray(p.choices) || p.choices.length !== 4)
          fail(`${at} mc인데 choices가 4개가 아닙니다 (${p.choices?.length})`);
        else {
          if (p.choices.some((c) => typeof c !== "string" || !c.trim()))
            fail(`${at} choices에 빈 보기가 있습니다`);
          if (new Set(p.choices.map((c) => String(c).trim())).size !== 4)
            fail(`${at} choices에 중복 보기가 있습니다`);
        }
        if (!Number.isInteger(p.answer) || p.answer < 0 || p.answer > 3)
          fail(`${at} mc answer가 0~3 정수가 아닙니다 (${JSON.stringify(p.answer)})`);
      } else if (p.type === "short") {
        short++;
        if (p.choices !== undefined) fail(`${at} short인데 choices가 있습니다`);
        if (!Array.isArray(p.answer) || p.answer.length === 0)
          fail(`${at} short answer가 비어있지 않은 배열이 아닙니다`);
        else {
          if (p.answer.some((a) => typeof a !== "string" || !a.trim()))
            fail(`${at} short answer에 빈 문자열이 있습니다`);
          const norm = p.answer.map((a) => String(a).trim().toLowerCase().replace(/\s+/g, ""));
          if (new Set(norm).size !== norm.length) fail(`${at} short answer에 중복 정답이 있습니다`);
        }
      } else {
        fail(`${at} type이 mc/short가 아닙니다 (${p.type})`);
      }

      if (p.explain !== undefined && typeof p.explain !== "string") fail(`${at} explain이 문자열이 아닙니다`);
      if (p.tag !== undefined && typeof p.tag !== "string") fail(`${at} tag가 문자열이 아닙니다`);
      if (p.tag) TAGS.set(`${sub}:${p.tag}`, (TAGS.get(`${sub}:${p.tag}`) ?? 0) + 1);
      if (p.level !== undefined) {
        if (!LEVELS.has(p.level)) fail(`${at} level 값 오류 (${p.level})`);
        else levelCount[p.level]++;
      }
    });

    rows.push({
      파일: rel,
      문항: arr.length,
      객관식: mc,
      단답: short,
      easy: levelCount.easy,
      normal: levelCount.normal,
      hard: levelCount.hard,
    });
  }
}

console.table(rows);
const total = rows.reduce((s, r) => s + r.문항, 0);
console.log(`\n총 ${rows.length}개 파일 · ${total}문제`);
console.log("태그 종류:", [...TAGS.keys()].sort().join(", "));

if (errors > 0) {
  console.error(`\n❌ 문제 ${errors}건 발견`);
  process.exit(1);
}
console.log("\n✅ 모든 검사 통과");
