import { Problem } from "./types";

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

const GENERATORS: Record<number, Gen[]> = { 1: g1, 2: g2, 3: g3, 4: g4, 5: g5, 6: g6 };

/** 학년에 맞는 연산 문제 n개 생성 (문제 텍스트 중복 없이) */
export function genMathProblems(grade: number, n: number): Problem[] {
  const gens = GENERATORS[Math.min(6, Math.max(1, grade))];
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
