import { bankProblems } from "./bank";
import { todayKST, daysAgoKST } from "./date";
import { genCustomProblems, genMathProblems } from "./mathgen";
import { kvGet, kvSet } from "./store";
import {
  AnswerRecord,
  DailySet,
  DEFAULT_CALC,
  DEFAULT_SETTINGS,
  History,
  Kid,
  Problem,
  PublicProblem,
  Settings,
  Subject,
  SUBJECTS,
  WrongItem,
} from "./types";

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Settings>("settings");
  if (!s) return { ...DEFAULT_SETTINGS, kids: [] };
  return s;
}

export async function saveSettings(s: Settings): Promise<void> {
  await kvSet("settings", s);
}

const setKey = (kidId: string, date: string, subject: Subject) => `set:${kidId}:${date}:${subject}`;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 문제은행에서 최근에 안 나온 문제 위주로 n개 뽑기 (다 소진되면 처음부터 다시) */
async function pickFromBank(kidId: string, subject: Subject, grade: number, n: number): Promise<Problem[]> {
  if (n <= 0) return [];
  const all = bankProblems(subject, grade);
  if (all.length === 0) return [];
  const usedKey = `used:${kidId}:${subject}:${grade}`;
  let used = (await kvGet<string[]>(usedKey)) ?? [];
  let avail = all.filter((p) => !used.includes(p.id));
  if (avail.length < n) {
    used = [];
    avail = [...all];
  }
  const chosen = shuffle([...avail]).slice(0, Math.min(n, avail.length));
  const keep = Math.max(0, all.length - n);
  const newUsed = [...used, ...chosen.map((p) => p.id)].slice(-keep);
  await kvSet(usedKey, newUsed);
  return chosen;
}

export type SetResult =
  | { set: DailySet; reason?: undefined }
  | { set: null; reason: "no-kid" | "off" | "empty-bank" };

/** 오늘의 문제 세트를 가져오거나, 없으면 새로 출제해서 저장 */
export async function getOrCreateSet(kidId: string, subject: Subject): Promise<SetResult> {
  const date = todayKST();
  const key = setKey(kidId, date, subject);
  const existing = await kvGet<DailySet>(key);
  if (existing) return { set: existing };

  const settings = await getSettings();
  const kid = settings.kids.find((k) => k.id === kidId);
  if (!kid) return { set: null, reason: "no-kid" };
  const count = kid.perDay[subject] ?? 0;
  if (count <= 0) return { set: null, reason: "off" };

  let problems: Problem[] = [];
  if (subject === "math") {
    const calc = kid.calc ?? DEFAULT_CALC;
    const custom = calc.mode === "custom" ? genCustomProblems(calc, count) : [];

    if (custom.length > 0) {
      // 부모가 직접 고른 연산으로 출제. 문장제를 섞기로 했다면 일부를 문장제로 채운다.
      const wordTarget = calc.includeWord ? Math.round(count * 0.3) : 0;
      const word = await pickFromBank(kidId, "math", kid.grade, wordTarget);
      const calcPart = custom.slice(0, count - word.length);
      problems = shuffle([...calcPart, ...word]);
    } else {
      // 학년 자동 = 연산(자동 생성) 60% + 문장제(문제은행) 40%
      // custom인데 켜진 연산이 하나도 없을 때도 여기로 와서 빈 숙제가 나오지 않게 한다.
      const wordTarget = Math.round(count * 0.4);
      const word = await pickFromBank(kidId, "math", kid.grade, wordTarget);
      const gen = genMathProblems(kid.grade, count - word.length);
      problems = shuffle([...gen, ...word]);
    }
  } else {
    problems = await pickFromBank(kidId, subject, kid.grade, count);
    if (problems.length === 0) return { set: null, reason: "empty-bank" };
  }

  const set: DailySet = {
    kidId,
    date,
    subject,
    problems,
    answers: problems.map(() => null),
    completedAt: null,
  };
  await kvSet(key, set);
  return { set };
}

export async function loadSet(kidId: string, subject: Subject, date: string): Promise<DailySet | null> {
  return kvGet<DailySet>(setKey(kidId, date, subject));
}

/** 클라이언트에 보낼 때 정답·해설 제거 */
export function toPublic(set: DailySet) {
  const problems: PublicProblem[] = set.problems.map((p) => ({
    id: p.id,
    type: p.type,
    q: p.q,
    choices: p.choices,
    tag: p.tag,
    level: p.level,
  }));
  return {
    date: set.date,
    subject: set.subject,
    total: set.problems.length,
    problems,
    answers: set.answers, // 이미 채점된 것에는 정답/해설 포함 (이미 공개된 정보)
    completedAt: set.completedAt,
  };
}

function normText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** "12개", "3/4", "2.8", "1,200" 등을 숫자로 해석 (분수 지원) */
function toNumber(s: string): number | null {
  const t = s.replace(/,/g, "").trim();
  const frac = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    if (d === 0) return null;
    return Number(frac[1]) / d;
  }
  const cleaned = t.replace(/[^\d.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

export function isCorrect(problem: Problem, given: string): boolean {
  if (problem.type === "mc") {
    return Number(given) === (problem.answer as number);
  }
  const accepted = problem.answer as string[];
  const g = normText(given);
  if (!g) return false;
  for (const a of accepted) {
    if (normText(a) === g) return true;
  }
  // 숫자/분수는 값이 같으면 정답 (예: "3/6" = "1/2" = "0.5")
  const gn = toNumber(given);
  if (gn !== null) {
    for (const a of accepted) {
      const an = toNumber(a);
      if (an !== null && Math.abs(an - gn) < 1e-9) return true;
    }
  }
  return false;
}

export function answerTextOf(p: Problem): string {
  if (p.type === "mc") return p.choices?.[p.answer as number] ?? "";
  return (p.answer as string[])[0] ?? "";
}

export interface SubmitOutcome {
  record: AnswerRecord;
  answered: number;
  total: number;
  correctCount: number;
  done: boolean;
}

export async function submitAnswer(
  kidId: string,
  subject: Subject,
  index: number,
  given: string,
): Promise<SubmitOutcome | { error: string }> {
  const date = todayKST();
  const key = setKey(kidId, date, subject);
  const set = await kvGet<DailySet>(key);
  if (!set) return { error: "no-set" };
  if (index < 0 || index >= set.problems.length) return { error: "bad-index" };

  const already = set.answers[index];
  const total = set.problems.length;

  if (!already) {
    const p = set.problems[index];
    const correct = isCorrect(p, given);
    set.answers[index] = {
      given,
      correct,
      answerText: answerTextOf(p),
      explain: p.explain ?? "",
    };
  }

  const answered = set.answers.filter(Boolean).length;
  const correctCount = set.answers.filter((a) => a?.correct).length;
  let justDone = false;

  if (answered === total && !set.completedAt) {
    set.completedAt = new Date().toISOString();
    justDone = true;
  }
  await kvSet(key, set);

  if (justDone) {
    // 완료 기록 저장
    const hKey = `history:${kidId}`;
    const h = (await kvGet<History>(hKey)) ?? {};
    h[date] = { ...(h[date] ?? {}), [subject]: { done: true, correct: correctCount, total } };
    await kvSet(hKey, h);

    // 오답 노트 적재
    const wrongs: WrongItem[] = [];
    set.answers.forEach((a, i) => {
      if (a && !a.correct) {
        wrongs.push({
          date,
          subject,
          q: set.problems[i].q,
          given: a.given,
          answerText: a.answerText,
          explain: a.explain,
        });
      }
    });
    if (wrongs.length > 0) {
      const wKey = `wrong:${kidId}`;
      const w = (await kvGet<WrongItem[]>(wKey)) ?? [];
      await kvSet(wKey, [...w, ...wrongs].slice(-120));
    }
  }

  return {
    record: set.answers[index]!,
    answered,
    total,
    correctCount,
    done: !!set.completedAt,
  };
}

/** 연속 달성일 계산: 켜진 과목을 모두 완료한 날이 이어진 수 (오늘 미완료면 어제까지 기준) */
export function calcStreak(kid: Kid, h: History): number {
  const enabled = SUBJECTS.filter((s) => (kid.perDay[s] ?? 0) > 0);
  if (enabled.length === 0) return 0;
  const isComplete = (d: string) => enabled.every((s) => h[d]?.[s]?.done);
  const offset = isComplete(todayKST()) ? 0 : 1;
  let streak = 0;
  for (let i = offset; i < offset + 400; i++) {
    if (isComplete(daysAgoKST(i))) streak++;
    else break;
  }
  return streak;
}

export interface SubjectToday {
  assigned: number; // 0이면 과목 꺼짐
  answered: number;
  total: number;
  correct: number;
  done: boolean;
}

export async function kidToday(kid: Kid): Promise<Record<Subject, SubjectToday>> {
  const date = todayKST();
  const out = {} as Record<Subject, SubjectToday>;
  for (const s of SUBJECTS) {
    const assigned = kid.perDay[s] ?? 0;
    if (assigned <= 0) {
      out[s] = { assigned: 0, answered: 0, total: 0, correct: 0, done: false };
      continue;
    }
    const set = await kvGet<DailySet>(setKey(kid.id, date, s));
    if (!set) {
      out[s] = { assigned, answered: 0, total: assigned, correct: 0, done: false };
    } else {
      out[s] = {
        assigned,
        answered: set.answers.filter(Boolean).length,
        total: set.problems.length,
        correct: set.answers.filter((a) => a?.correct).length,
        done: !!set.completedAt,
      };
    }
  }
  return out;
}
