/**
 * lib/bank.ts 의 문제은행 import 목록을 실제 파일에 맞춰 다시 만든다.
 *
 * 학년이 늘 때마다 import 20~30줄을 손으로 고치면 하나쯤 빠뜨리기 쉽고,
 * 빠뜨리면 그 학년만 조용히 빈 문제은행이 된다. 그래서 파일을 훑어 생성한다.
 *
 * 실행: node scripts/wire-bank.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const SUBJECTS = ["ko", "en", "math"];
const MAX_GRADE = 9;

const imports = [];
const entries = { ko: [], en: [], math: [] };
const missing = [];

for (const s of SUBJECTS) {
  for (let g = 1; g <= MAX_GRADE; g++) {
    const rel = `data/problems/${s}/grade${g}.json`;
    if (!existsSync(rel)) {
      missing.push(rel);
      continue;
    }
    const varName = `${s}${g}`;
    imports.push(`import ${varName} from "@/data/problems/${s}/grade${g}.json";`);
    entries[s].push(`    ${g}: ${varName} as Problem[],`);
  }
}

if (missing.length) {
  console.log("아직 없는 파일 (연결에서 제외):");
  missing.forEach((m) => console.log("  " + m));
}

const body = `import { clampGrade, MAX_GRADE, Problem, Subject } from "./types";

// 이 목록은 scripts/wire-bank.mjs 가 실제 파일을 훑어 만든다.
// 학년을 추가한 뒤 \`node scripts/wire-bank.mjs\` 를 실행하면 갱신된다.
${imports.join("\n")}

const BANK: Record<Subject, Record<number, Problem[]>> = {
${SUBJECTS.map((s) => `  ${s}: {\n${entries[s].join("\n")}\n  },`).join("\n")}
};

export function bankProblems(subject: Subject, grade: number): Problem[] {
  return BANK[subject][clampGrade(grade)] ?? [];
}

/** 과목/학년별 문제은행 보유량 (부모 대시보드용) */
export function bankCounts(): Record<Subject, Record<number, number>> {
  const out = {} as Record<Subject, Record<number, number>>;
  (Object.keys(BANK) as Subject[]).forEach((s) => {
    out[s] = {};
    for (let g = 1; g <= MAX_GRADE; g++) out[s][g] = BANK[s][g]?.length ?? 0;
  });
  return out;
}
`;

const target = path.join("lib", "bank.ts");
const before = existsSync(target) ? readFileSync(target, "utf8") : "";
if (before === body) {
  console.log("변경 없음");
} else {
  writeFileSync(target, body);
  console.log(`lib/bank.ts 갱신 — 문제은행 ${imports.length}개 파일 연결`);
}
