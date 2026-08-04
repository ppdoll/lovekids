import { bankProblems } from "./bank";
import { todayKST, daysAgoKST } from "./date";
import { genCustomProblems, genMathProblems } from "./mathgen";
import { Store } from "./scope";
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

export async function getSettings(store: Store): Promise<Settings> {
  const s = await store.get<Settings>("settings");
  if (!s) return { ...DEFAULT_SETTINGS, kids: [] };
  return s;
}

export async function saveSettings(store: Store, s: Settings): Promise<void> {
  await store.set("settings", s);
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
async function pickFromBank(store: Store, kidId: string, subject: Subject, grade: number, n: number): Promise<Problem[]> {
  if (n <= 0) return [];
  const all = bankProblems(subject, grade);
  if (all.length === 0) return [];
  const usedKey = `used:${kidId}:${subject}:${grade}`;
  let used = (await store.get<string[]>(usedKey)) ?? [];
  let avail = all.filter((p) => !used.includes(p.id));
  if (avail.length < n) {
    used = [];
    avail = [...all];
  }
  const chosen = shuffle([...avail]).slice(0, Math.min(n, avail.length));
  const keep = Math.max(0, all.length - n);
  const newUsed = [...used, ...chosen.map((p) => p.id)].slice(-keep);
  await store.set(usedKey, newUsed);
  return chosen;
}

export type SetResult =
  | { set: DailySet; reason?: undefined }
  | { set: null; reason: "no-kid" | "off" | "empty-bank" };

/**
 * 아이·과목에 맞는 문제 count개를 만든다.
 * 새 숙제를 낼 때와 부모가 문제를 더 낼 때 같은 규칙을 쓰도록 한 곳에 모아둔다.
 */
async function buildProblems(store: Store, kid: Kid, subject: Subject, count: number): Promise<Problem[]> {
  if (count <= 0) return [];

  if (subject !== "math") {
    return pickFromBank(store, kid.id, subject, kid.grade, count);
  }

  const calc = kid.calc ?? DEFAULT_CALC;
  const custom = calc.mode === "custom" ? genCustomProblems(calc, count) : [];

  if (custom.length > 0) {
    // 부모가 직접 고른 연산으로 출제. 문장제를 섞기로 했다면 일부를 문장제로 채운다.
    const wordTarget = calc.includeWord ? Math.round(count * 0.3) : 0;
    const word = await pickFromBank(store, kid.id, "math", kid.grade, wordTarget);
    const calcPart = custom.slice(0, count - word.length);
    return shuffle([...calcPart, ...word]);
  }

  // 학년 자동 = 연산(자동 생성) 60% + 문장제(문제은행) 40%
  // custom인데 켜진 연산이 하나도 없을 때도 여기로 와서 빈 숙제가 나오지 않게 한다.
  const wordTarget = Math.round(count * 0.4);
  const word = await pickFromBank(store, kid.id, "math", kid.grade, wordTarget);
  const gen = genMathProblems(kid.grade, count - word.length);
  return shuffle([...gen, ...word]);
}

/** 오늘의 문제 세트를 가져오거나, 없으면 새로 출제해서 저장 */
export async function getOrCreateSet(store: Store, kidId: string, subject: Subject): Promise<SetResult> {
  const date = todayKST();
  const key = setKey(kidId, date, subject);
  const existing = await store.get<DailySet>(key);
  if (existing) return { set: existing };

  const settings = await getSettings(store);
  const kid = settings.kids.find((k) => k.id === kidId);
  if (!kid) return { set: null, reason: "no-kid" };
  const count = kid.perDay[subject] ?? 0;
  if (count <= 0) return { set: null, reason: "off" };

  const problems = await buildProblems(store, kid, subject, count);
  if (problems.length === 0) return { set: null, reason: "empty-bank" };

  const set: DailySet = {
    kidId,
    date,
    subject,
    problems,
    answers: problems.map(() => null),
    completedAt: null,
    bestCombo: 0,
    wrongPushedIdx: [],
  };
  await store.set(key, set);
  return { set };
}

/** 오늘 이 과목 숙제를 없애서 다시 처음부터 풀게 한다 (오답 노트는 남긴다) */
export async function resetToday(store: Store, kidId: string, subject: Subject): Promise<void> {
  const date = todayKST();
  await store.del(setKey(kidId, date, subject));

  // 완료 기록도 지워야 달력·연속 달성이 실제 상태와 맞는다
  const hKey = `history:${kidId}`;
  const h = (await store.get<History>(hKey)) ?? {};
  if (h[date]?.[subject]) {
    delete h[date]![subject];
    if (Object.keys(h[date]!).length === 0) delete h[date];
    await store.set(hKey, h);
  }
}

export type AddResult =
  | { added: number; total: number }
  | { error: "no-kid" | "off" | "no-more" };

/** 오늘 이 과목에 문제를 n개 더 낸다 */
export async function addToToday(store: Store, kidId: string, subject: Subject, n: number): Promise<AddResult> {
  const settings = await getSettings(store);
  const kid = settings.kids.find((k) => k.id === kidId);
  if (!kid) return { error: "no-kid" };

  const date = todayKST();
  const key = setKey(kidId, date, subject);
  let set = await store.get<DailySet>(key);

  // 아직 시작 안 한 과목이면 오늘 숙제를 먼저 만든다
  if (!set) {
    const created = await getOrCreateSet(store, kidId, subject);
    if (!created.set) return { error: created.reason === "off" ? "off" : "no-kid" };
    set = created.set;
  }

  const existing = new Set(set.problems.map((p) => p.q));
  const fresh = (await buildProblems(store, kid, subject, n * 3)).filter((p) => {
    if (existing.has(p.q)) return false;
    existing.add(p.q);
    return true;
  });
  const add = fresh.slice(0, n);
  if (add.length === 0) return { error: "no-more" };

  set.problems.push(...add);
  set.answers.push(...add.map(() => null));

  // 문제가 늘었으니 아직 다 푼 게 아니다. 완료 기록도 다시 풀 때까지 내린다.
  if (set.completedAt) {
    set.completedAt = null;
    const hKey = `history:${kidId}`;
    const h = (await store.get<History>(hKey)) ?? {};
    if (h[date]?.[subject]) {
      delete h[date]![subject];
      if (Object.keys(h[date]!).length === 0) delete h[date];
      await store.set(hKey, h);
    }
  }
  await store.set(key, set);
  return { added: add.length, total: set.problems.length };
}

/**
 * 연속 정답(콤보) 계산.
 * 문제는 앞에서부터 순서대로 풀리므로, 처음부터 훑어 이어지는 정답 수를 센다.
 */
export function calcCombo(answers: (AnswerRecord | null)[]): { current: number; best: number } {
  let current = 0;
  let best = 0;
  for (const a of answers) {
    if (!a) break; // 아직 풀지 않은 문제부터는 세지 않는다
    if (a.correct) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return { current, best };
}

export async function loadSet(store: Store, kidId: string, subject: Subject, date: string): Promise<DailySet | null> {
  return store.get<DailySet>(setKey(kidId, date, subject));
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
  const combo = calcCombo(set.answers);
  return {
    date: set.date,
    subject: set.subject,
    total: set.problems.length,
    problems,
    answers: set.answers, // 이미 채점된 것에는 정답/해설 포함 (이미 공개된 정보)
    completedAt: set.completedAt,
    combo: combo.current, // 새로고침해도 콤보가 이어지도록
    bestCombo: Math.max(set.bestCombo ?? 0, combo.best),
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
  /** 지금까지 이어진 연속 정답 수 */
  combo: number;
  /** 오늘 이 과목의 최고 연속 정답 수 */
  bestCombo: number;
}

export async function submitAnswer(
  store: Store,
  kidId: string,
  subject: Subject,
  index: number,
  given: string,
): Promise<SubmitOutcome | { error: string }> {
  const date = todayKST();
  const key = setKey(kidId, date, subject);
  const set = await store.get<DailySet>(key);
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
  const combo = calcCombo(set.answers);
  set.bestCombo = Math.max(set.bestCombo ?? 0, combo.best);
  let justDone = false;

  if (answered === total && !set.completedAt) {
    set.completedAt = new Date().toISOString();
    justDone = true;
  }

  if (justDone) {
    // 완료 기록 저장
    const hKey = `history:${kidId}`;
    const h = (await store.get<History>(hKey)) ?? {};
    h[date] = { ...(h[date] ?? {}), [subject]: { done: true, correct: correctCount, total } };
    await store.set(hKey, h);

    // 오답 노트 적재 — 이미 올린 문제는 건너뛴다
    // (부모가 문제를 더 내면 다시 완료 처리되는데, 그때 앞 문제들이 또 쌓이면 안 된다)
    const pushed = new Set(set.wrongPushedIdx ?? []);
    const wrongs: WrongItem[] = [];
    set.answers.forEach((a, i) => {
      if (a && !a.correct && !pushed.has(i)) {
        pushed.add(i);
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
    set.wrongPushedIdx = [...pushed];
    if (wrongs.length > 0) {
      const wKey = `wrong:${kidId}`;
      const w = (await store.get<WrongItem[]>(wKey)) ?? [];
      await store.set(wKey, [...w, ...wrongs].slice(-120));
    }
  }

  await store.set(key, set);

  return {
    record: set.answers[index]!,
    answered,
    total,
    correctCount,
    done: !!set.completedAt,
    combo: combo.current,
    bestCombo: set.bestCombo,
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

export async function kidToday(store: Store, kid: Kid): Promise<Record<Subject, SubjectToday>> {
  const date = todayKST();
  const out = {} as Record<Subject, SubjectToday>;
  for (const s of SUBJECTS) {
    const assigned = kid.perDay[s] ?? 0;
    if (assigned <= 0) {
      out[s] = { assigned: 0, answered: 0, total: 0, correct: 0, done: false };
      continue;
    }
    const set = await store.get<DailySet>(setKey(kid.id, date, s));
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
