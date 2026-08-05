import { clampGrade, Problem } from "./types";

/**
 * 수학 문장제(이야기 문제) 자동 생성기.
 *
 * 4칙연산처럼 문장제도 그때그때 만들어내면 문제은행이 마를 일이 없다.
 * 이름·물건·숫자를 바꿔 끼우는 방식이라 정답은 항상 숫자에서 계산되므로 틀릴 수가 없다.
 * (문제은행의 손으로 쓴 문장제와 섞어 쓰면 문장 구조가 반복되는 느낌이 줄어든다)
 *
 * 조사를 받침에 맞춰 붙이는 데 특히 신경 썼다. "지우이는 사탕을" 처럼 어색한 문장이 나오면
 * 아이도 부모도 바로 알아채기 때문이다.
 */

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T,>(arr: T[]): T => arr[ri(0, arr.length - 1)];

/* ─────────── 한글 조사 ─────────── */

/** 마지막 글자에 받침이 있는지 */
function hasJong(word: string): boolean {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return false;
  return c % 28 !== 0;
}

const 은는 = (w: string) => w + (hasJong(w) ? "은" : "는");
const 이가 = (w: string) => w + (hasJong(w) ? "이" : "가");
const 을를 = (w: string) => w + (hasJong(w) ? "을" : "를");
const 과와 = (w: string) => w + (hasJong(w) ? "과" : "와");

/**
 * 사람 **이름** 뒤에 붙는 조사. 받침이 있으면 "이"를 끼운다 ("서준이는" / "지우는").
 * 주의: 이 규칙은 이름에만 쓴다. "형", "동생" 같은 일반 낱말에 쓰면
 * "형이에게"처럼 어색해지므로 그런 낱말에는 조사를 그냥 붙인다.
 */
const 이름은 = (n: string) => (hasJong(n) ? `${n}이는` : `${n}는`);
const 이름이 = (n: string) => (hasJong(n) ? `${n}이가` : `${n}가`);
const 이름보다 = (n: string) => (hasJong(n) ? `${n}이보다` : `${n}보다`);
const 이름의 = (n: string) => (hasJong(n) ? `${n}이의` : `${n}의`);

/* ─────────── 바꿔 끼울 재료 ─────────── */

const KID_NAMES = [
  "지우", "서준", "하윤", "민재", "예은", "도현", "수아", "지호", "채원", "은우",
  "다온", "시윤", "나윤", "준서", "소율", "현우", "지안", "예린", "유진", "태윤",
];

const FAMILY = ["동생", "형", "누나", "언니", "오빠", "친구", "짝꿍", "사촌"];

/** [물건 이름, 세는 단위] */
const THINGS: [string, string][] = [
  ["사탕", "개"], ["색종이", "장"], ["구슬", "개"], ["딸기", "개"], ["연필", "자루"],
  ["공책", "권"], ["스티커", "장"], ["젤리", "개"], ["귤", "개"], ["블록", "개"],
  ["카드", "장"], ["방울토마토", "개"], ["클립", "개"], ["도토리", "개"], ["종이컵", "개"],
];

const PLACES = ["교실", "도서관", "놀이터", "체육관", "강당", "운동장", "미술실"];

const CONTAINERS = ["상자", "바구니", "봉지", "접시", "필통"];

/** 두 아이 이름을 서로 다르게 뽑는다 */
function twoNames(): [string, string] {
  const a = pick(KID_NAMES);
  let b = pick(KID_NAMES);
  if (b === a) b = KID_NAMES[(KID_NAMES.indexOf(a) + 1) % KID_NAMES.length];
  return [a, b];
}

let seq = 0;
function short(q: string, answers: string[], explain: string): Problem {
  seq = (seq + 1) % 100000;
  return {
    id: `wgen-${Date.now().toString(36)}-${seq}`,
    type: "short",
    q,
    answer: answers,
    explain,
    tag: "문장제",
    level: "normal",
  };
}

/** 숫자만 써도, 단위를 붙여 써도 정답으로 받아준다 */
const withUnit = (n: number, unit: string) => [`${n}`, `${n}${unit}`];

type Gen = () => Problem;

/* ── 1~2학년: 덧셈·뺄셈 상황 ── */
const easyGens: Gen[] = [
  () => {
    const name = pick(KID_NAMES);
    const [thing, unit] = pick(THINGS);
    const a = ri(5, 40);
    const b = ri(2, Math.min(a - 1, 20));
    return short(
      `${이름은(name)} ${을를(thing)} ${a}${unit} 가지고 있었습니다. ${pick(FAMILY)}에게 ${b}${을를(unit)} 주었습니다. 남은 ${은는(thing)} 몇 ${unit}인가요?`,
      withUnit(a - b, unit),
      `${a} - ${b} = ${a - b}`,
    );
  },
  () => {
    const [thing, unit] = pick(THINGS);
    const box = pick(CONTAINERS);
    const a = ri(3, 30);
    const b = ri(2, 25);
    return short(
      `${box}에 ${이가(thing)} ${a}${unit} 있습니다. ${이름이(pick(KID_NAMES))} ${b}${을를(unit)} 더 넣었습니다. ${box}의 ${은는(thing)} 모두 몇 ${unit}인가요?`,
      withUnit(a + b, unit),
      `${a} + ${b} = ${a + b}`,
    );
  },
  () => {
    const place = pick(PLACES);
    const a = ri(8, 30);
    const out = ri(2, a - 2);
    const inn = ri(1, 15);
    return short(
      `${place}에 학생 ${a}명이 있었습니다. ${out}명이 나가고 ${inn}명이 새로 들어왔습니다. 지금 ${place}에 있는 학생은 몇 명인가요?`,
      withUnit(a - out + inn, "명"),
      `${a} - ${out} + ${inn} = ${a - out + inn}`,
    );
  },
  () => {
    const [n1, n2] = twoNames();
    const [thing, unit] = pick(THINGS);
    const a = ri(10, 60);
    const diff = ri(2, 20);
    return short(
      `${이름은(n1)} ${을를(thing)} ${a}${unit}, ${이름은(n2)} ${a + diff}${unit} 모았습니다. ${이름은(n2)} ${이름보다(n1)} 몇 ${unit} 더 많이 모았나요?`,
      withUnit(diff, unit),
      `${a + diff} - ${a} = ${diff}`,
    );
  },
];

/* ── 2~4학년: 곱셈·나눗셈 상황 ── */
const midGens: Gen[] = [
  () => {
    const box = pick(CONTAINERS);
    const [thing, unit] = pick(THINGS);
    const per = ri(2, 9);
    const boxes = ri(2, 9);
    return short(
      `${box} 한 개에 ${이가(thing)} ${per}${unit}씩 들어 있습니다. ${box} ${boxes}개에 있는 ${은는(thing)} 모두 몇 ${unit}인가요?`,
      withUnit(per * boxes, unit),
      `${per} × ${boxes} = ${per * boxes}`,
    );
  },
  () => {
    const [thing, unit] = pick(THINGS);
    const people = ri(2, 8);
    const each = ri(2, 9);
    return short(
      `${thing} ${people * each}${을를(unit)} ${people}명이 똑같이 나누어 가지려고 합니다. 한 명이 몇 ${unit}씩 가지게 되나요?`,
      withUnit(each, unit),
      `${people * each} ÷ ${people} = ${each}`,
    );
  },
  () => {
    const [thing] = pick(THINGS);
    const price = ri(2, 9) * 100;
    const count = ri(2, 9);
    return short(
      `${thing} 한 개가 ${price}원입니다. ${count}개를 사려면 얼마가 필요한가요? (숫자만 쓰세요)`,
      withUnit(price * count, "원"),
      `${price} × ${count} = ${price * count}`,
    );
  },
  () => {
    const [thing, unit] = pick(THINGS);
    const per = ri(3, 8);
    const boxes = ri(3, 9);
    const left = ri(1, per - 1);
    const total = per * boxes + left;
    return short(
      `${thing} ${total}${을를(unit)} 한 봉지에 ${per}${unit}씩 담으려고 합니다. 봉지에 담고 남는 ${은는(thing)} 몇 ${unit}인가요?`,
      withUnit(left, unit),
      `${total} ÷ ${per} = ${boxes}봉지, 나머지 ${left}${unit}`,
    );
  },
  () => {
    const rows = ri(3, 9);
    const cols = ri(3, 9);
    return short(
      `의자를 ${rows}줄로 놓고 한 줄에 ${cols}개씩 두었습니다. 의자는 모두 몇 개인가요?`,
      withUnit(rows * cols, "개"),
      `${rows} × ${cols} = ${rows * cols}`,
    );
  },
];

/* ── 4~6학년: 평균·비율·단위 상황 ── */
const hardGens: Gen[] = [
  () => {
    const n = pick([3, 4, 5]);
    const scores = Array.from({ length: n }, () => ri(60, 100));
    const rest = scores.reduce((s, v) => s + v, 0) % n;
    if (rest !== 0) scores[n - 1] += n - rest;
    const sum = scores.reduce((s, v) => s + v, 0);
    return short(
      `${이름의(pick(KID_NAMES))} 시험 점수가 ${scores.join("점, ")}점입니다. 평균은 몇 점인가요? (숫자만 쓰세요)`,
      withUnit(sum / n, "점"),
      `모두 더하면 ${sum}점, ${n}으로 나누면 ${sum / n}점`,
    );
  },
  () => {
    // 사람 수가 소수로 나오면 안 되므로, 퍼센트를 먼저 고르고 딱 나누어지는 인원만 쓴다
    // (예: 10%면 인원이 10의 배수여야 12.5명 같은 답이 안 나온다)
    const pct = pick([10, 20, 25, 40, 50, 60, 75, 80]);
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const step = 100 / gcd(pct, 100);
    const total = step * ri(2, Math.max(2, Math.floor(300 / step)));
    const wearing = (total * pct) / 100;
    return short(
      `${pick(PLACES)}에 있는 학생 ${total}명 중 ${pct}%가 안경을 썼습니다. 안경을 쓴 학생은 몇 명인가요?`,
      withUnit(wearing, "명"),
      `${total} × ${pct}/100 = ${wearing}`,
    );
  },
  () => {
    const price = ri(4, 20) * 1000;
    const off = pick([10, 20, 25, 30, 40, 50]);
    const pay = price - (price * off) / 100;
    return short(
      `${price}원짜리 물건을 ${off}% 할인해서 판다면, 내야 할 돈은 얼마인가요? (숫자만 쓰세요)`,
      withUnit(pay, "원"),
      `할인액 ${(price * off) / 100}원 → ${price} - ${(price * off) / 100} = ${pay}원`,
    );
  },
  () => {
    const w = ri(4, 25);
    const h = ri(4, 25);
    return short(
      `가로 ${w}m, 세로 ${h}m인 직사각형 모양 텃밭의 넓이는 몇 m²인가요? (숫자만 쓰세요)`,
      [`${w * h}`],
      `${w} × ${h} = ${w * h}`,
    );
  },
  () => {
    const km = ri(2, 12);
    const min = ri(2, 6) * 10;
    return short(
      `${이름이(pick(KID_NAMES))} ${min}분 동안 ${km}km를 걸었습니다. 같은 빠르기로 ${min * 3}분을 걸으면 몇 km를 갈 수 있나요? (숫자만 쓰세요)`,
      withUnit(km * 3, "km"),
      `시간이 3배가 되면 거리도 3배 → ${km} × 3 = ${km * 3}`,
    );
  },
  () => {
    const liters = ri(2, 9);
    const ml = ri(1, 9) * 100;
    return short(
      `물통에 물이 ${liters}L ${ml}mL 들어 있습니다. 모두 몇 mL인가요? (숫자만 쓰세요)`,
      withUnit(liters * 1000 + ml, "mL"),
      `1L는 1000mL이므로 ${liters}L는 ${liters * 1000}mL → ${liters * 1000} + ${ml} = ${liters * 1000 + ml}`,
    );
  },
  () => {
    const [n1, n2] = twoNames();
    const total = ri(3, 15) * 8;
    const ratio = pick([[1, 3], [3, 5], [1, 7], [3, 1], [5, 3]]);
    const part = (total * ratio[0]) / (ratio[0] + ratio[1]);
    if (!Number.isInteger(part)) return hardGens[0]();
    return short(
      `사탕 ${total}개를 ${이름과(n1)} ${이름이(n2)} ${ratio[0]} : ${ratio[1]}의 비로 나누어 가지려고 합니다. ${이름은(n1)} 몇 개를 가지게 되나요?`,
      withUnit(part, "개"),
      `전체를 ${ratio[0] + ratio[1]}묶음으로 보면 한 묶음은 ${total / (ratio[0] + ratio[1])}개 → ${ratio[0]}묶음은 ${part}개`,
    );
  },
];

/** 이름 + "과/와" (받침 있으면 "서준이와", 없으면 "지우와") */
function 이름과(n: string): string {
  return hasJong(n) ? `${n}이와` : `${n}와`;
}

/* ── 중학생(7~9학년): 방정식 활용, 속력, 농도, 경우의 수 ──
 *
 * 중학생에게 "사탕을 나눠 가지기" 같은 문제를 내면 시시하다.
 * 식을 세워야 풀리는 문제로 바꾸되, 답은 숫자 하나로 떨어지게 만든다.
 */
const middleGens: Gen[] = [
  () => {
    // 나이 문제 (일차방정식 활용)
    const years = ri(3, 20);
    const k = pick([2, 3]);
    const child = ri(8, 18);
    const parent = k * (child + years) - years;
    if (parent <= child || parent > 70) return middleGens[1]();
    return short(
      `현재 아버지의 나이는 ${parent}살, 아이의 나이는 ${child}살입니다. 아버지의 나이가 아이의 나이의 ${k}배가 되는 것은 몇 년 후인가요?`,
      withUnit(years, "년"),
      `${parent} + x = ${k}(${child} + x) → x = ${years}`,
    );
  },
  () => {
    // 거리 = 속력 × 시간
    const speed = ri(3, 12) * 10;
    const hours = pick([1.5, 2, 2.5, 3, 4]);
    const dist = speed * hours;
    if (!Number.isInteger(dist)) return middleGens[2]();
    const label = Number.isInteger(hours) ? `${hours}시간` : `${Math.floor(hours)}시간 30분`;
    return short(
      `시속 ${speed}km로 ${label} 동안 달렸다면 이동한 거리는 몇 km인가요?`,
      withUnit(dist, "km"),
      `거리 = 속력 × 시간 = ${speed} × ${hours} = ${dist}`,
    );
  },
  () => {
    // 소금물 농도
    const pct = pick([5, 8, 10, 12, 15, 20, 25]);
    const g = pick([100, 150, 200, 250, 300, 400]);
    const salt = (g * pct) / 100;
    if (!Number.isInteger(salt)) return middleGens[3]();
    return short(
      `농도가 ${pct}%인 소금물 ${g}g에 녹아 있는 소금은 몇 g인가요?`,
      withUnit(salt, "g"),
      `소금의 양 = ${g} × ${pct}/100 = ${salt}`,
    );
  },
  () => {
    // 다리 개수 (연립방정식 활용)
    const chicken = ri(4, 20);
    const pig = ri(3, 15);
    const heads = chicken + pig;
    const legs = chicken * 2 + pig * 4;
    return short(
      `닭과 돼지가 합해서 ${heads}마리 있고, 다리는 모두 ${legs}개입니다. 닭은 몇 마리인가요?`,
      withUnit(chicken, "마리"),
      `닭 x, 돼지 y → x + y = ${heads}, 2x + 4y = ${legs} → x = ${chicken}`,
    );
  },
  () => {
    // 어떤 수 구하기 (일차방정식)
    const x = ri(-12, 20) || 7;
    const a = ri(2, 9);
    const b = ri(-15, 15);
    return short(
      `어떤 수를 ${a}배 한 뒤 ${b >= 0 ? `${b}을 더하면` : `${-b}을 빼면`} ${a * x + b}이 됩니다. 어떤 수는 얼마인가요?`,
      [`${x}`],
      `${a}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${a * x + b} → x = ${x}`,
    );
  },
  () => {
    // 경우의 수 (곱의 법칙)
    const a = ri(3, 7);
    const b = ri(2, 6);
    const items = pick([
      ["티셔츠", "바지", "옷차림"],
      ["빵", "음료", "세트"],
      ["윗옷", "신발", "차림"],
    ]);
    return short(
      `서로 다른 ${items[0]} ${a}가지와 ${items[1]} ${b}가지가 있습니다. 하나씩 골라 만들 수 있는 ${items[2]}는 모두 몇 가지인가요?`,
      withUnit(a * b, "가지"),
      `${a} × ${b} = ${a * b}`,
    );
  },
  () => {
    // 정가 = 원가 + 이익
    const cost = ri(4, 30) * 1000;
    const rate = pick([10, 20, 25, 30, 50]);
    const price = cost + (cost * rate) / 100;
    return short(
      `원가가 ${cost}원인 물건에 ${rate}%의 이익을 붙여 정가를 정했습니다. 정가는 얼마인가요? (숫자만 쓰세요)`,
      withUnit(price, "원"),
      `${cost} + ${cost} × ${rate}/100 = ${price}`,
    );
  },
  () => {
    // 이차방정식 활용 (직사각형)
    const w = ri(3, 15);
    const gap = ri(2, 8);
    const area = w * (w + gap);
    return short(
      `가로가 세로보다 ${gap}cm 긴 직사각형의 넓이가 ${area}cm²입니다. 세로의 길이는 몇 cm인가요?`,
      withUnit(w, "cm"),
      `x(x + ${gap}) = ${area} → x = ${w}`,
    );
  },
  () => {
    // 연속하는 수
    const n = pick([3, 5]);
    const mid = ri(5, 40);
    const nums = Array.from({ length: n }, (_, i) => mid - Math.floor(n / 2) + i);
    const sum = nums.reduce((s, v) => s + v, 0);
    return short(
      `연속하는 ${n}개의 자연수의 합이 ${sum}입니다. 가장 작은 수는 얼마인가요?`,
      [`${nums[0]}`],
      `가운데 수가 ${mid}이므로 ${nums.join(" + ")} = ${sum}`,
    );
  },
];

/** 학년에 맞는 문장제 후보 (겹치게 넣어 가중치를 준다) */
function gensFor(grade: number): Gen[] {
  if (grade <= 2) return easyGens;
  if (grade <= 4) return [...easyGens, ...midGens, ...midGens];
  // 중학생(7~9)에게 초등 문장제를 내면 시시하다. 비율·평균 같은 실생활 문제 위주로 둔다.
  if (grade <= 6) return [...midGens, ...hardGens, ...hardGens];
  // 중학생에게 "사탕 나눠 갖기"는 시시하다. 식을 세워야 풀리는 문제 위주로 두고,
  // 비율·평균 같은 실생활 문제를 조금 섞는다.
  return [...middleGens, ...middleGens, ...hardGens];
}

/** 학년에 맞는 문장제 n개 생성 (문제 텍스트 중복 없이) */
export function genWordProblems(grade: number, n: number): Problem[] {
  if (n <= 0) return [];
  const gens = gensFor(clampGrade(grade));
  const out: Problem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard < n * 40) {
    guard++;
    const p = gens[ri(0, gens.length - 1)]();
    if (seen.has(p.q)) continue;
    seen.add(p.q);
    out.push(p);
  }
  return out;
}

// 과/와 조사 함수는 위 제너레이터에서 쓰이므로 내보내지 않아도 되지만,
// 조사 처리가 맞는지 검사에서 확인할 수 있게 열어 둔다.
export const _particles = { hasJong, 은는, 이가, 을를, 과와, 이름은, 이름이, 이름과 };
