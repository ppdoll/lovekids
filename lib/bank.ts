import { clampGrade, MAX_GRADE, Problem, Subject } from "./types";

// 이 목록은 scripts/wire-bank.mjs 가 실제 파일을 훑어 만든다.
// 학년을 추가한 뒤 `node scripts/wire-bank.mjs` 를 실행하면 갱신된다.
import ko1 from "@/data/problems/ko/grade1.json";
import ko2 from "@/data/problems/ko/grade2.json";
import ko3 from "@/data/problems/ko/grade3.json";
import ko4 from "@/data/problems/ko/grade4.json";
import ko5 from "@/data/problems/ko/grade5.json";
import ko6 from "@/data/problems/ko/grade6.json";
import ko7 from "@/data/problems/ko/grade7.json";
import ko8 from "@/data/problems/ko/grade8.json";
import ko9 from "@/data/problems/ko/grade9.json";
import en1 from "@/data/problems/en/grade1.json";
import en2 from "@/data/problems/en/grade2.json";
import en3 from "@/data/problems/en/grade3.json";
import en4 from "@/data/problems/en/grade4.json";
import en5 from "@/data/problems/en/grade5.json";
import en6 from "@/data/problems/en/grade6.json";
import en7 from "@/data/problems/en/grade7.json";
import en8 from "@/data/problems/en/grade8.json";
import en9 from "@/data/problems/en/grade9.json";
import math1 from "@/data/problems/math/grade1.json";
import math2 from "@/data/problems/math/grade2.json";
import math3 from "@/data/problems/math/grade3.json";
import math4 from "@/data/problems/math/grade4.json";
import math5 from "@/data/problems/math/grade5.json";
import math6 from "@/data/problems/math/grade6.json";
import math7 from "@/data/problems/math/grade7.json";
import math8 from "@/data/problems/math/grade8.json";
import math9 from "@/data/problems/math/grade9.json";

const BANK: Record<Subject, Record<number, Problem[]>> = {
  ko: {
    1: ko1 as Problem[],
    2: ko2 as Problem[],
    3: ko3 as Problem[],
    4: ko4 as Problem[],
    5: ko5 as Problem[],
    6: ko6 as Problem[],
    7: ko7 as Problem[],
    8: ko8 as Problem[],
    9: ko9 as Problem[],
  },
  en: {
    1: en1 as Problem[],
    2: en2 as Problem[],
    3: en3 as Problem[],
    4: en4 as Problem[],
    5: en5 as Problem[],
    6: en6 as Problem[],
    7: en7 as Problem[],
    8: en8 as Problem[],
    9: en9 as Problem[],
  },
  math: {
    1: math1 as Problem[],
    2: math2 as Problem[],
    3: math3 as Problem[],
    4: math4 as Problem[],
    5: math5 as Problem[],
    6: math6 as Problem[],
    7: math7 as Problem[],
    8: math8 as Problem[],
    9: math9 as Problem[],
  },
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
