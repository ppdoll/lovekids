import { CalcConfig, clampGrade, Problem } from "./types";

/**
 * 학년별 수학 연산 문제 자동 생성기.
 * 문장제는 문제은행(data/problems/math)에서 가져오고, 여기서는 계산 문제만 만든다.
 */

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T,>(arr: T[]): T => arr[ri(0, arr.length - 1)];
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * min~max 중 서로 다른 수 k개를 뽑는다.
 * 뽑을 수 있는 후보가 k개보다 적으면 있는 만큼만 돌려준다 —
 * 값이 모일 때까지 반복하는 방식은 후보가 부족할 때 영원히 멈추지 않으므로 쓰지 않는다.
 */
function distinctInts(min: number, max: number, k: number): number[] {
  const pool: number[] = [];
  for (let v = min; v <= max; v++) pool.push(v);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k);
}

/** 소수를 불필요한 0 없이 문자열로 */
const fmt = (x: number) => parseFloat(x.toFixed(4)).toString();

/**
 * 식을 교과서에서 쓰는 대로 적는다.
 * "y = 3x + 0", "y = 1x", "x² + 1x - 6" 처럼 나오면 답은 맞아도 아이가 배운 표기와 달라
 * 문제가 잘못된 것처럼 보인다. 계수 1은 생략하고, 0인 항은 아예 쓰지 않는다.
 */
/** 맨 앞 항: 3x / x / -x */
const term = (coef: number, v: string) => (coef === 1 ? v : coef === -1 ? `-${v}` : `${coef}${v}`);
/** 뒤에 더해지는 항: " + 3" / " - 3" / " + x" / 0이면 빈 문자열 */
const addend = (n: number, v = "") => {
  if (n === 0) return "";
  const size = Math.abs(n);
  return ` ${n > 0 ? "+" : "-"} ${v && size === 1 ? v : `${size}${v}`}`;
};

let seq = 0;
function short(q: string, answers: string[], tag: string, explain = ""): Problem {
  seq = (seq + 1) % 100000;
  return {
    id: `gen-${Date.now().toString(36)}-${seq}`,
    type: "short",
    q,
    answer: answers,
    explain,
    tag,
    level: "normal",
  };
}

function mc(q: string, choices: string[], answerIdx: number, tag: string, explain = ""): Problem {
  seq = (seq + 1) % 100000;
  return {
    id: `gen-${Date.now().toString(36)}-${seq}`,
    type: "mc",
    q,
    choices,
    answer: answerIdx,
    explain,
    tag,
    level: "normal",
  };
}

function reduceFrac(n: number, d: number): [number, number] {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return [n / g, d / g];
}

function fracAnswers(n: number, d: number): string[] {
  const [rn, rd] = reduceFrac(n, d);
  const set = new Set<string>([`${n}/${d}`, `${rn}/${rd}`]);
  if (rd === 1) set.add(`${rn}`);
  return [...set];
}

type Gen = () => Problem;

const g1: Gen[] = [
  () => {
    const a = ri(1, 9), b = ri(1, 9);
    return short(`${a} + ${b} = ?`, [`${a + b}`], "덧셈", `${a}에 ${b}를 더하면 ${a + b}이에요.`);
  },
  () => {
    const a = ri(2, 9), b = ri(1, a - 1);
    return short(`${a} - ${b} = ?`, [`${a - b}`], "뺄셈", `${a}에서 ${b}를 빼면 ${a - b}이에요.`);
  },
  () => {
    const a = ri(1, 8), ans = ri(1, 9 - a);
    return short(`${a} + □ = ${a + ans}\n□에 들어갈 수는?`, [`${ans}`], "덧셈", `${a}에 ${ans}를 더해야 ${a + ans}이 돼요.`);
  },
  () => {
    const a = ri(1, 9);
    return short(`10 + ${a} = ?`, [`${10 + a}`], "덧셈", `10에 ${a}를 더하면 ${10 + a}이에요.`);
  },
  () => {
    const arr = distinctInts(1, 50, 4);
    const max = Math.max(...arr);
    return mc("가장 큰 수를 고르세요.", arr.map(String), arr.indexOf(max), "수 비교", `${max}가 가장 커요.`);
  },
  () => {
    const a = ri(11, 19), b = ri(1, a - 11);
    return short(`${a} - ${b} = ?`, [`${a - b}`], "뺄셈", `${a}에서 ${b}를 빼면 ${a - b}이에요.`);
  },
];

const g2: Gen[] = [
  () => {
    const a = ri(10, 99), b = ri(10, 99);
    return short(`${a} + ${b} = ?`, [`${a + b}`], "덧셈");
  },
  () => {
    const a = ri(30, 99), b = ri(10, a - 1);
    return short(`${a} - ${b} = ?`, [`${a - b}`], "뺄셈");
  },
  () => {
    const a = ri(2, 9), b = ri(2, 9);
    return short(`${a} × ${b} = ?`, [`${a * b}`], "곱셈구구", `${a}단을 떠올려 보세요. ${a} × ${b} = ${a * b}`);
  },
  () => {
    const a = ri(2, 9), ans = ri(2, 9);
    return short(`${a} × □ = ${a * ans}\n□에 들어갈 수는?`, [`${ans}`], "곱셈구구", `${a} × ${ans} = ${a * ans}이에요.`);
  },
  () => {
    const a = ri(10, 50), b = ri(10, 40), c = ri(1, 20);
    return short(`${a} + ${b} - ${c} = ?`, [`${a + b - c}`], "세 수 계산", "앞에서부터 차례로 계산해요.");
  },
  () => {
    const m = ri(1, 5), cm = ri(1, 99);
    return short(`${m}m ${cm}cm는 모두 몇 cm일까요? (숫자만 쓰세요)`, [`${m * 100 + cm}`, `${m * 100 + cm}cm`], "길이", `1m는 100cm이므로 ${m}m는 ${m * 100}cm예요.`);
  },
];

const g3: Gen[] = [
  () => {
    const a = ri(100, 899), b = ri(100, 999 - Math.min(a, 899));
    return short(`${a} + ${b} = ?`, [`${a + b}`], "덧셈");
  },
  () => {
    const a = ri(300, 999), b = ri(100, a - 100);
    return short(`${a} - ${b} = ?`, [`${a - b}`], "뺄셈");
  },
  () => {
    const a = ri(11, 99), b = ri(2, 9);
    return short(`${a} × ${b} = ?`, [`${a * b}`], "곱셈");
  },
  () => {
    const b = ri(2, 9), q = ri(2, 9);
    return short(`${b * q} ÷ ${b} = ?`, [`${q}`], "나눗셈", `${b} × ${q} = ${b * q}이므로 몫은 ${q}예요.`);
  },
  () => {
    const b = ri(2, 9), q = ri(3, 12), r = ri(1, b - 1);
    const a = b * q + r;
    return short(`${a} ÷ ${b}의 나머지는 얼마일까요?`, [`${r}`], "나눗셈", `${a} = ${b} × ${q} + ${r}이므로 나머지는 ${r}이에요.`);
  },
  () => {
    // 서로 다른 분자 4개가 필요하므로 분모는 5 이상이어야 한다 (분모 4는 분자 후보가 1,2,3뿐)
    const d = ri(5, 9);
    const arr = distinctInts(1, d - 1, 4);
    const max = Math.max(...arr);
    return mc(
      `분모가 같은 분수 중 가장 큰 것을 고르세요.`,
      arr.map((n) => `${n}/${d}`),
      arr.indexOf(max),
      "분수",
      "분모가 같으면 분자가 클수록 큰 분수예요.",
    );
  },
];

const g4: Gen[] = [
  () => {
    const a = ri(100, 999), b = ri(10, 99);
    return short(`${a} × ${b} = ?`, [`${a * b}`], "곱셈");
  },
  () => {
    const b = ri(12, 29), q = ri(4, 30);
    return short(`${b * q} ÷ ${b} = ?`, [`${q}`], "나눗셈");
  },
  () => {
    const d = ri(4, 9), a = ri(1, d - 2), b = ri(1, d - 1 - a);
    return short(
      `${a}/${d} + ${b}/${d} = ?\n(답은 분수로 쓰세요. 예: 3/5)`,
      fracAnswers(a + b, d),
      "분수 덧셈",
      "분모가 같으면 분자끼리 더해요.",
    );
  },
  () => {
    const d = ri(4, 9), b = ri(1, d - 2), add = ri(1, d - 1 - b);
    const a = b + add;
    return short(
      `${a}/${d} - ${b}/${d} = ?\n(답은 분수로 쓰세요. 예: 2/5)`,
      fracAnswers(a - b, d),
      "분수 뺄셈",
      "분모가 같으면 분자끼리 빼요.",
    );
  },
  () => {
    const a = ri(1, 99) / 10, b = ri(1, 99) / 10;
    return short(`${fmt(a)} + ${fmt(b)} = ?\n(답은 소수로 쓰세요)`, [fmt(a + b)], "소수 덧셈", "소수점 자리를 맞추어 더해요.");
  },
  () => {
    const a = ri(20, 90), b = ri(20, Math.min(140 - a, 100));
    const c = 180 - a - b;
    return short(
      `삼각형의 두 각이 ${a}°, ${b}°일 때 나머지 한 각은 몇 도일까요? (숫자만 쓰세요)`,
      [`${c}`, `${c}도`],
      "각도",
      "삼각형 세 각의 합은 180°예요.",
    );
  },
];

const g5: Gen[] = [
  () => {
    const g = ri(2, 9);
    const [m1, m2] = distinctInts(2, 8, 2); // 두 수가 같아지지 않도록 배수를 서로 다르게
    const x = g * m1;
    const y = g * m2;
    return short(`${x}와(과) ${y}의 최대공약수는?`, [`${gcd(x, y)}`], "약수와 배수");
  },
  () => {
    const a = ri(2, 9), b = ri(2, 9);
    const l = (a * b) / gcd(a, b);
    return short(`${a}와(과) ${b}의 최소공배수는?`, [`${l}`], "약수와 배수");
  },
  () => {
    let d1 = pick([2, 3, 4, 5, 6]), d2 = pick([2, 3, 4, 5, 6, 7, 8, 9]);
    if (d1 === d2) d2 = d1 + 1;
    const a = ri(1, d1 - 1), b = ri(1, d2 - 1);
    const n = a * d2 + b * d1, d = d1 * d2;
    return short(
      `${a}/${d1} + ${b}/${d2} = ?\n(답은 분수로 쓰세요. 예: 7/12)`,
      fracAnswers(n, d),
      "분수 덧셈",
      "분모를 통분한 다음 분자끼리 더해요.",
    );
  },
  () => {
    const d = ri(3, 9), a = ri(1, d - 1), n = ri(2, 9);
    return short(
      `${a}/${d} × ${n} = ?\n(답은 분수나 자연수로 쓰세요)`,
      fracAnswers(a * n, d),
      "분수 곱셈",
      "분자에 자연수를 곱해요.",
    );
  },
  () => {
    const a = ri(2, 99) / 10, b = ri(2, 9) / 10;
    return short(`${fmt(a)} × ${fmt(b)} = ?\n(답은 소수로 쓰세요)`, [fmt(a * b)], "소수 곱셈");
  },
  () => {
    // 수를 먼저 정하고, 마지막 수만 올려서 합이 개수로 나누어떨어지게 만든다 (평균이 항상 자연수)
    const n = pick([3, 4]);
    const nums = Array.from({ length: n }, () => ri(4, 60));
    const rest = nums.reduce((s, v) => s + v, 0) % n;
    if (rest !== 0) nums[n - 1] += n - rest;
    const sum = nums.reduce((s, v) => s + v, 0);
    const avg = sum / n;
    return short(
      `다음 수들의 평균을 구하세요.\n${nums.join(", ")}`,
      [`${avg}`],
      "평균",
      `모두 더하면 ${sum}, ${n}으로 나누면 ${avg}이에요.`,
    );
  },
  () => {
    const w = ri(3, 20), h = ri(3, 20);
    const isArea = Math.random() < 0.6;
    return isArea
      ? short(`가로 ${w}cm, 세로 ${h}cm인 직사각형의 넓이는 몇 cm²일까요? (숫자만)`, [`${w * h}`], "넓이", "직사각형 넓이 = 가로 × 세로")
      : short(`가로 ${w}cm, 세로 ${h}cm인 직사각형의 둘레는 몇 cm일까요? (숫자만)`, [`${(w + h) * 2}`], "둘레", "둘레 = (가로 + 세로) × 2");
  },
];

const g6: Gen[] = [
  () => {
    const d1 = ri(2, 9), a = ri(1, d1 - 1), d2 = ri(2, 9), b = ri(1, d2 - 1);
    const n = a * d2, d = d1 * b;
    return short(
      `${a}/${d1} ÷ ${b}/${d2} = ?\n(답은 분수나 자연수로 쓰세요)`,
      fracAnswers(n, d),
      "분수 나눗셈",
      "나누는 분수를 뒤집어 곱해요.",
    );
  },
  () => {
    const b = ri(2, 9) / 10, q = ri(2, 20);
    const a = b * q;
    return short(`${fmt(a)} ÷ ${fmt(b)} = ?`, [fmt(q)], "소수 나눗셈");
  },
  () => {
    const n = ri(1, 20) * 20, p = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]);
    return short(`${n}의 ${p}%는 얼마일까요? (숫자만)`, [`${(n * p) / 100}`], "백분율", `${n} × ${p}/100 = ${(n * p) / 100}`);
  },
  () => {
    const pairs: [number, number][] = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [1, 20], [1, 25]];
    const [a, b] = pick(pairs);
    return short(`분수 ${a}/${b}를 백분율(%)로 나타내면? (숫자만)`, [`${(a / b) * 100}`, `${(a / b) * 100}%`], "백분율", `${a} ÷ ${b} = ${fmt(a / b)}이고, 100을 곱하면 ${(a / b) * 100}%예요.`);
  },
  () => {
    const r = ri(2, 10);
    return short(
      `반지름이 ${r}cm인 원의 넓이는? (원주율 3.14, 숫자만)`,
      [fmt(r * r * 3.14)],
      "원의 넓이",
      "원의 넓이 = 반지름 × 반지름 × 3.14",
    );
  },
  () => {
    const d = ri(2, 15);
    return short(
      `지름이 ${d}cm인 원의 둘레(원주)는? (원주율 3.14, 숫자만)`,
      [fmt(d * 3.14)],
      "원주",
      "원주 = 지름 × 3.14",
    );
  },
  () => {
    const a = ri(2, 12), b = ri(2, 12), c = ri(2, 12);
    return short(
      `가로 ${a}cm, 세로 ${b}cm, 높이 ${c}cm인 직육면체의 부피는 몇 cm³일까요? (숫자만)`,
      [`${a * b * c}`],
      "부피",
      "부피 = 가로 × 세로 × 높이",
    );
  },
];

/* ─────────── 중학교 ───────────
 *
 * 답은 전부 "숫자 하나"로 나오게 만든다.
 * "(x+2)(x+3)" 같은 식을 답으로 받으면 쓰는 방식이 사람마다 달라서
 * 아는데도 오답 처리되기 쉽다. 그래서 근의 값, 계수, 지수처럼 숫자를 묻는다.
 */

/** 음수를 식에 넣을 때 괄호를 씌운다: 5 + (-3) */
const sg = (n: number) => (n < 0 ? `(${n})` : `${n}`);

/* ── 중1 (7학년): 정수와 유리수, 문자와 식, 일차방정식, 도형 ── */
const g7: Gen[] = [
  () => {
    const a = ri(-20, 20) || 3;
    const b = ri(-20, 20) || -5;
    return short(`${sg(a)} + ${sg(b)} = ?`, [`${a + b}`], "정수의 계산", `${a} + (${b}) = ${a + b}`);
  },
  () => {
    const a = ri(-15, 15) || 7;
    const b = ri(-15, 15) || -4;
    return short(`${sg(a)} - ${sg(b)} = ?`, [`${a - b}`], "정수의 계산", `빼기는 부호를 바꿔 더한다 → ${a} + ${-b} = ${a - b}`);
  },
  () => {
    const a = ri(-12, 12) || -6;
    const b = ri(-12, 12) || 4;
    return short(`${sg(a)} × ${sg(b)} = ?`, [`${a * b}`], "정수의 계산", `부호가 ${a * b < 0 ? "다르므로 음수" : "같으므로 양수"} → ${a * b}`);
  },
  () => {
    const b = ri(2, 12) * (Math.random() < 0.5 ? 1 : -1);
    const q = ri(-12, 12) || 3;
    return short(`${sg(b * q)} ÷ ${sg(b)} = ?`, [`${q}`], "정수의 계산", `${b} × ${q} = ${b * q}`);
  },
  () => {
    const base = ri(-5, -2);
    const exp = ri(2, 3);
    return short(`(${base})^${exp} 의 값은?`, [`${base ** exp}`], "거듭제곱",
      `음수를 ${exp}번 곱하면 ${exp % 2 === 0 ? "양수" : "음수"} → ${base ** exp}`);
  },
  () => {
    // 일차방정식 ax + b = c (정수해)
    const a = ri(2, 9);
    const x = ri(-9, 9) || 4;
    const b = ri(-20, 20);
    return short(`${term(a, "x")}${addend(b)} = ${a * x + b} 일 때, x의 값은?`,
      [`${x}`], "일차방정식", `${term(a, "x")} = ${a * x} → x = ${x}`);
  },
  () => {
    // 양변에 x가 있는 일차방정식
    const a = ri(3, 9);
    const c = ri(1, a - 1);
    const x = ri(-8, 8) || 3;
    const b = ri(-15, 15);
    const d = (a - c) * x + b;
    return short(`${term(a, "x")}${addend(b)} = ${term(c, "x")}${addend(d)} 일 때, x의 값은?`,
      [`${x}`], "일차방정식", `${term(a - c, "x")} = ${d - b} → x = ${x}`);
  },
  () => {
    const a = ri(2, 9), b = ri(2, 9), k = ri(2, 6);
    return short(`비례식 ${a} : ${b} = ${a * k} : x 에서 x의 값은?`, [`${b * k}`], "비례식",
      `${a}에 ${k}를 곱했으므로 ${b}에도 ${k}를 곱한다 → ${b * k}`);
  },
  () => {
    // 부채꼴: 답을 π의 계수로 물어 숫자로 만든다
    const r = ri(2, 12);
    const deg = pick([30, 45, 60, 90, 120, 135, 150, 180]);
    const arcNum = 2 * r * deg;
    if (arcNum % 360 !== 0) return g7[8]();
    return short(
      `반지름이 ${r}, 중심각이 ${deg}°인 부채꼴의 호의 길이는 aπ입니다. a의 값은?`,
      [`${arcNum / 360}`],
      "부채꼴",
      `호의 길이 = 2π×${r}×${deg}/360 = ${arcNum / 360}π`,
    );
  },
  () => {
    const a = ri(2, 9);
    const x = ri(2, 9);
    return short(`정비례 관계 y = ${a}x 에서 x = ${x}일 때 y의 값은?`, [`${a * x}`], "정비례",
      `${a} × ${x} = ${a * x}`);
  },
  () => {
    const k = ri(2, 12) * ri(2, 6);
    const divs = [];
    for (let d = 1; d <= k; d++) if (k % d === 0) divs.push(d);
    return short(`${k}의 약수는 모두 몇 개인가요?`, [`${divs.length}`], "약수와 배수",
      `약수: ${divs.join(", ")}`);
  },
];

/* ── 중2 (8학년): 식의 계산, 부등식, 연립방정식, 일차함수, 피타고라스, 확률 ── */
const g8: Gen[] = [
  () => {
    const m = ri(2, 7), n = ri(2, 7);
    return short(`x^${m} × x^${n} = x^k 일 때, k의 값은?`, [`${m + n}`], "지수법칙",
      `밑이 같은 거듭제곱의 곱셈은 지수를 더한다 → ${m} + ${n} = ${m + n}`);
  },
  () => {
    const m = ri(3, 9), n = ri(2, m - 1);
    return short(`x^${m} ÷ x^${n} = x^k 일 때, k의 값은?`, [`${m - n}`], "지수법칙",
      `나눗셈은 지수를 뺀다 → ${m} - ${n} = ${m - n}`);
  },
  () => {
    const m = ri(2, 6), n = ri(2, 5);
    return short(`(x^${m})^${n} = x^k 일 때, k의 값은?`, [`${m * n}`], "지수법칙",
      `거듭제곱의 거듭제곱은 지수를 곱한다 → ${m} × ${n} = ${m * n}`);
  },
  () => {
    // 일차부등식의 자연수 해의 개수
    const a = ri(2, 6);
    const limit = ri(3, 12);
    const b = ri(1, 15);
    const rhs = a * limit + b;
    return short(
      `부등식 ${a}x + ${b} < ${rhs} 을 만족하는 자연수 x는 모두 몇 개인가요?`,
      [`${limit - 1}`],
      "부등식",
      `${a}x < ${rhs - b} → x < ${limit} 이므로 1부터 ${limit - 1}까지 ${limit - 1}개`,
    );
  },
  () => {
    // 연립방정식 (정수해) — x의 값을 묻는다
    const x = ri(-6, 8) || 2;
    const y = ri(-6, 8) || 3;
    const a = ri(1, 5), b = ri(1, 5), c = ri(1, 5), d = ri(1, 5);
    if (a * d - b * c === 0) return g8[4]();
    return short(
      `연립방정식\n${term(a, "x")}${addend(b, "y")} = ${a * x + b * y}\n${term(c, "x")}${addend(d, "y")} = ${c * x + d * y}\n의 해에서 x의 값은?`,
      [`${x}`],
      "연립방정식",
      `x = ${x}, y = ${y}`,
    );
  },
  () => {
    // 두 점을 지나는 직선의 기울기 (정수)
    const x1 = ri(-6, 6), dx = pick([1, 2, 3, 4]);
    const x2 = x1 + dx;
    const m = ri(-5, 5) || 2;
    const y1 = ri(-8, 8);
    const y2 = y1 + m * dx;
    return short(
      `두 점 (${x1}, ${y1}), (${x2}, ${y2})을 지나는 직선의 기울기는?`,
      [`${m}`],
      "일차함수",
      `(${y2} - ${y1}) ÷ (${x2} - ${x1}) = ${m}`,
    );
  },
  () => {
    const a = ri(-5, 5) || 3;
    const b = ri(-10, 10);
    const x = ri(-6, 6);
    return short(`일차함수 y = ${term(a, "x")}${addend(b)} 에서 x = ${x}일 때 y의 값은?`,
      [`${a * x + b}`], "일차함수", `${a} × (${x})${addend(b)} = ${a * x + b}`);
  },
  () => {
    // 피타고라스 (정수 삼각형)
    const triples: [number, number, number][] = [
      [3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [7, 24, 25], [20, 21, 29], [12, 16, 20],
    ];
    const [a, b, c] = pick(triples);
    return Math.random() < 0.6
      ? short(`직각삼각형의 두 변의 길이가 ${a}, ${b}일 때 빗변의 길이는? (두 변은 직각을 낀 변)`,
          [`${c}`], "피타고라스", `${a}² + ${b}² = ${a * a + b * b} = ${c}²`)
      : short(`빗변의 길이가 ${c}이고 한 변의 길이가 ${a}인 직각삼각형에서 나머지 한 변의 길이는?`,
          [`${b}`], "피타고라스", `${c}² - ${a}² = ${c * c - a * a} = ${b}²`);
  },
  () => {
    // 확률 — 분모를 물어 숫자로
    const kind = pick(["dice", "coin"]);
    if (kind === "dice") {
      const target = pick([
        ["짝수", 3], ["3의 배수", 2], ["4 이상", 3], ["소수", 3],
      ] as [string, number][]);
      return short(
        `주사위 한 개를 던질 때 ${target[0]}의 눈이 나올 확률은 a/6 입니다. a의 값은?`,
        [`${target[1]}`],
        "확률",
        `해당하는 눈이 ${target[1]}가지이므로 ${target[1]}/6`,
      );
    }
    const n = ri(2, 4);
    return short(
      `동전 ${n}개를 동시에 던질 때 나올 수 있는 모든 경우의 수는?`,
      [`${2 ** n}`],
      "확률",
      `2를 ${n}번 곱한다 → ${2 ** n}`,
    );
  },
];

/* ── 중3 (9학년): 제곱근, 인수분해, 이차방정식, 이차함수, 삼각비 ── */
const g9: Gen[] = [
  () => {
    const n = ri(2, 20);
    return short(`√${n * n} 의 값은?`, [`${n}`], "제곱근", `${n}² = ${n * n}`);
  },
  () => {
    // √(k²m) = k√m 꼴에서 k를 묻는다
    const k = ri(2, 6);
    const m = pick([2, 3, 5, 6, 7, 10]);
    return short(`√${k * k * m} 을 a√${m} 꼴로 나타낼 때 a의 값은?`, [`${k}`], "제곱근",
      `√${k * k * m} = √${k * k} × √${m} = ${k}√${m}`);
  },
  () => {
    // a√m + b√m
    const m = pick([2, 3, 5, 7]);
    const a = ri(2, 7), b = ri(2, 7);
    return short(`${a}√${m} + ${b}√${m} = a√${m} 일 때 a의 값은?`, [`${a + b}`], "근호의 계산",
      `같은 근호끼리 계수를 더한다 → ${a} + ${b} = ${a + b}`);
  },
  () => {
    // 인수분해 → 두 근
    const p = ri(-9, 9) || 2;
    const q = ri(-9, 9) || -3;
    const b = -(p + q);
    const c = p * q;
    const big = Math.max(p, q);
    return short(
      `이차방정식 x²${addend(b, "x")}${addend(c)} = 0 의 두 근 중 큰 값은?`,
      [`${big}`],
      "이차방정식",
      `(x ${-p >= 0 ? "+" : "-"} ${Math.abs(p)})(x ${-q >= 0 ? "+" : "-"} ${Math.abs(q)}) = 0 → x = ${p} 또는 x = ${q}`,
    );
  },
  () => {
    const p = ri(-8, 8) || 3;
    const q = ri(-8, 8) || -4;
    const b = -(p + q);
    const c = p * q;
    return short(
      `이차방정식 x²${addend(b, "x")}${addend(c)} = 0 의 두 근의 합은?`,
      [`${p + q}`],
      "이차방정식",
      `두 근의 합은 -(일차항 계수) → ${p + q}`,
    );
  },
  () => {
    // x² + bx + c 인수분해에서 (x+p)(x+q)의 p+q
    const p = ri(1, 9), q = ri(1, 9);
    return short(
      `x² + ${p + q}x + ${p * q} 을 (x + a)(x + b) 로 인수분해할 때, a × b 의 값은?`,
      [`${p * q}`],
      "인수분해",
      `합이 ${p + q}, 곱이 ${p * q}인 두 수는 ${p}와 ${q}`,
    );
  },
  () => {
    // 이차함수 꼭짓점
    const p = ri(-6, 6);
    const q = ri(-10, 10);
    const a = pick([1, -1, 2, -2]);
    return short(
      `이차함수 y = ${term(a, "")}${p === 0 ? "x²" : `(x${addend(-p)})²`}${addend(q)} 의 꼭짓점의 x좌표는?`,
      [`${p}`],
      "이차함수",
      `꼭짓점은 (${p}, ${q})`,
    );
  },
  () => {
    // 특수각 삼각비 — 유리수 값만 묻는다
    const cases: [string, string][] = [
      ["sin 30°", "1/2"], ["cos 60°", "1/2"], ["tan 45°", "1"], ["sin 90°", "1"],
      ["cos 0°", "1"], ["sin 0°", "0"], ["cos 90°", "0"], ["tan 0°", "0"],
    ];
    const [q, a] = pick(cases);
    return short(`${q} 의 값은? (분수는 1/2 처럼 쓰세요)`, [a], "삼각비", `${q} = ${a}`);
  },
  () => {
    // 직각삼각형에서의 삼각비 (3-4-5 계열)
    const triples: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
    const [a, b, c] = pick(triples);
    return short(
      `직각삼각형에서 밑변 ${b}, 높이 ${a}, 빗변 ${c}일 때 sinθ = a/${c} 입니다. (θ는 밑변과 빗변 사이의 각) a의 값은?`,
      [`${a}`],
      "삼각비",
      `sinθ = 높이/빗변 = ${a}/${c}`,
    );
  },
];

const GENERATORS: Record<number, Gen[]> = { 1: g1, 2: g2, 3: g3, 4: g4, 5: g5, 6: g6, 7: g7, 8: g8, 9: g9 };

/* ─────────── 부모가 직접 고른 설정으로 만드는 연산 문제 ─────────── */

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/** 자리수 d인 수의 범위 */
function digitRange(d: number): [number, number] {
  return [d === 1 ? 1 : 10 ** (d - 1), 10 ** d - 1];
}

const fromDigits = (ds: number[]) => ds.reduce((acc, v, i) => acc + v * 10 ** i, 0);

/**
 * 덧셈. 올림(받아올림) 여부를 우연에 맡기지 않고 자리별로 만들어 보장한다.
 * - carry=false: 모든 자리의 합이 9 이하 → 올림이 절대 없음
 * - carry=true: 일의 자리 합을 10 이상으로 만들어 올림이 반드시 한 번은 생김
 */
function genAdd(digits: number, carry: boolean): Problem {
  const d = clampInt(digits, 1, 4);

  if (d === 1) {
    const a = carry ? ri(1, 9) : ri(1, 8);
    const b = carry ? ri(Math.max(1, 10 - a), 9) : ri(1, 9 - a);
    return short(`${a} + ${b} = ?`, [`${a + b}`], "덧셈", `${a} + ${b} = ${a + b}`);
  }

  const da: number[] = [];
  const db: number[] = [];
  if (carry) {
    const oa = ri(1, 9);
    da[0] = oa;
    db[0] = ri(10 - oa, 9);
  } else {
    const oa = ri(0, 9);
    da[0] = oa;
    db[0] = ri(0, 9 - oa);
  }
  for (let i = 1; i < d; i++) {
    const top = i === d - 1;
    if (carry) {
      da[i] = top ? ri(1, 9) : ri(0, 9);
      db[i] = top ? ri(1, 9) : ri(0, 9);
    } else {
      const lo = top ? 1 : 0;
      const x = ri(lo, top ? 8 : 9);
      da[i] = x;
      db[i] = ri(lo, 9 - x);
    }
  }
  const a = fromDigits(da);
  const b = fromDigits(db);
  return short(
    `${a} + ${b} = ?`,
    [`${a + b}`],
    "덧셈",
    carry ? "자리 올림이 있어요. 일의 자리부터 차례로 더해요." : `${a} + ${b} = ${a + b}`,
  );
}

/**
 * 뺄셈. 빌려주기(내림) 여부를 만들면서 보장한다.
 * - borrow=false: 모든 자리에서 위의 수가 아래 수보다 크거나 같음 → 빌려올 필요 없음
 * - borrow=true: 일의 자리에서 반드시 빌려와야 하도록 만든다
 */
function genSub(digits: number, borrow: boolean): Problem {
  const d = clampInt(digits, 1, 4);

  // 한 자리 뺄셈에는 빌려주기가 존재하지 않는다
  if (d === 1) {
    const a = ri(2, 9);
    const b = ri(1, a);
    return short(`${a} - ${b} = ?`, [`${a - b}`], "뺄셈", `${a} - ${b} = ${a - b}`);
  }

  if (borrow) {
    const oa = ri(0, 8);
    const ob = ri(oa + 1, 9); // 일의 자리에서 빌려와야 함
    const [ulo, uhi] = digitRange(d - 1);
    const ua = ri(ulo + 1, uhi);
    const ub = ri(ulo, ua - 1); // 윗자리는 a가 더 크므로 전체적으로 a > b
    const a = ua * 10 + oa;
    const b = ub * 10 + ob;
    return short(`${a} - ${b} = ?`, [`${a - b}`], "뺄셈", "일의 자리에서 십의 자리에게 빌려와야 해요.");
  }

  // 모든 자리에서 a의 숫자가 b보다 크거나 같아야 빌려올 일이 없다.
  // 게다가 최상위 자리는 a가 "확실히 더 크게" 만들어, 두 수가 같아지는 경우(답이 0)를 원천적으로 없앤다.
  // (예전에는 a === b일 때 a에 1을 더해 피했는데, 일의 자리가 9면 자리올림이 생겨
  //  "빌려주기 없음" 조건이 깨졌다.)
  const da: number[] = [];
  const db: number[] = [];
  const oa = ri(0, 9);
  da[0] = oa;
  db[0] = ri(0, oa);
  for (let i = 1; i < d; i++) {
    const top = i === d - 1;
    if (top) {
      const x = ri(2, 9);
      da[i] = x;
      db[i] = ri(1, x - 1);
    } else {
      const x = ri(0, 9);
      da[i] = x;
      db[i] = ri(0, x);
    }
  }
  const a = fromDigits(da);
  const b = fromDigits(db);
  return short(`${a} - ${b} = ?`, [`${a - b}`], "뺄셈", `${a} - ${b} = ${a - b}`);
}

/** 곱셈. 부모가 고른 단만 나온다 */
function genMul(tables: number[]): Problem {
  const pool = tables.length ? tables : [2, 3, 4, 5, 6, 7, 8, 9];
  const t = pick(pool);
  const m = ri(1, 9);
  // 같은 단이라도 앞뒤로 번갈아 나오게 해서 외운 순서에만 의존하지 않도록
  const [x, y] = Math.random() < 0.5 ? [t, m] : [m, t];
  return short(`${x} × ${y} = ?`, [`${x * y}`], "곱셈", `${t}단 → ${t} × ${m} = ${t * m}`);
}

/**
 * 나눗셈.
 * remainder=true일 때는 몫과 나머지를 한 칸에 같이 적게 하지 않고 따로 묻는다.
 * ("3...1" 같은 형식을 아이가 맞춰 쓰게 하면 아는데도 오답이 되기 쉽다)
 */
function genDiv(remainder: boolean, tables: number[]): Problem {
  const pool = (tables.length ? tables : [2, 3, 4, 5, 6, 7, 8, 9]).filter((t) => t >= 2);
  const b = pick(pool.length ? pool : [2, 3, 4, 5, 6, 7, 8, 9]);
  const q = ri(2, 9);

  if (!remainder || b < 2) {
    const a = b * q;
    return short(`${a} ÷ ${b} = ?`, [`${q}`], "나눗셈", `${b} × ${q} = ${a}이므로 몫은 ${q}예요.`);
  }

  const r = ri(1, b - 1);
  const a = b * q + r;
  // 나머지가 있는 나눗셈은 몫과 나머지를 번갈아 묻는다
  return Math.random() < 0.5
    ? short(`${a} ÷ ${b}의 몫은 얼마일까요?`, [`${q}`], "나눗셈", `${a} = ${b} × ${q} + ${r} → 몫 ${q}, 나머지 ${r}`)
    : short(`${a} ÷ ${b}의 나머지는 얼마일까요?`, [`${r}`], "나눗셈", `${a} = ${b} × ${q} + ${r} → 몫 ${q}, 나머지 ${r}`);
}

/** 부모가 고른 연산 설정으로 문제 n개 생성. 켜진 연산이 없으면 빈 배열. */
export function genCustomProblems(calc: CalcConfig, n: number): Problem[] {
  const gens: Gen[] = [];
  if (calc.add?.on) gens.push(() => genAdd(calc.add.digits, calc.add.carry));
  if (calc.sub?.on) gens.push(() => genSub(calc.sub.digits, calc.sub.borrow));
  if (calc.mul?.on) gens.push(() => genMul(calc.mul.tables ?? []));
  if (calc.div?.on) gens.push(() => genDiv(calc.div.remainder, calc.mul?.tables ?? []));
  if (gens.length === 0) return [];

  const out: Problem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard < n * 40) {
    guard++;
    const p = pick(gens)();
    if (seen.has(p.q)) continue;
    seen.add(p.q);
    out.push(p);
  }
  return out;
}

/** 학년에 맞는 연산 문제 n개 생성 (문제 텍스트 중복 없이) */
export function genMathProblems(grade: number, n: number): Problem[] {
  const gens = GENERATORS[clampGrade(grade)];
  const out: Problem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard < n * 30) {
    guard++;
    const p = pick(gens)();
    if (seen.has(p.q)) continue;
    seen.add(p.q);
    out.push(p);
  }
  return out;
}
