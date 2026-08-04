export type Subject = "ko" | "en" | "math";

export const SUBJECTS: Subject[] = ["ko", "en", "math"];

export const SUBJECT_LABEL: Record<Subject, string> = {
  ko: "국어",
  en: "영어",
  math: "수학",
};

export const SUBJECT_EMOJI: Record<Subject, string> = {
  ko: "📖",
  en: "🅰️",
  math: "🔢",
};

export interface Problem {
  id: string;
  type: "mc" | "short";
  q: string;
  choices?: string[];
  /** mc: 정답 인덱스(0~3) / short: 허용 정답 문자열 배열 */
  answer: number | string[];
  explain?: string;
  tag?: string;
  level?: "easy" | "normal" | "hard";
}

/** 클라이언트로 내려보내는, 정답이 제거된 문제 */
export type PublicProblem = Omit<Problem, "answer" | "explain">;

/** 연산 연습 설정 — 수학 문제에 어떤 계산이 나올지 부모가 직접 정한다 */
export interface CalcConfig {
  /** auto: 학년 교육과정에 맞춰 자동 / custom: 아래 설정대로 */
  mode: "auto" | "custom";
  /** 계산 문제 외에 문장제(이야기 문제)도 섞을지 */
  includeWord: boolean;
  add: { on: boolean; digits: number; carry: boolean };
  /** borrow: 빌려주기(내림)가 필요한 문제를 낼지 */
  sub: { on: boolean; digits: number; borrow: boolean };
  /** tables: 문제에 나올 단 (2~19) */
  mul: { on: boolean; tables: number[] };
  /** remainder: 나머지가 있는 나눗셈을 낼지 */
  div: { on: boolean; remainder: boolean };
}

export const DEFAULT_CALC: CalcConfig = {
  mode: "auto",
  includeWord: true,
  add: { on: true, digits: 2, carry: true },
  sub: { on: true, digits: 2, borrow: true },
  mul: { on: true, tables: [2, 3, 4, 5, 6, 7, 8, 9] },
  div: { on: false, remainder: false },
};

export const MUL_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19];

export interface Kid {
  id: string;
  name: string;
  grade: number; // 1~6
  emoji: string;
  perDay: Record<Subject, number>; // 과목별 하루 문제 수 (0이면 과목 끔)
  calc?: CalcConfig; // 없으면 auto (예전에 등록한 아이도 그대로 동작)
}

export interface Settings {
  kids: Kid[];
  parentPin: string;
}

export interface AnswerRecord {
  given: string;
  correct: boolean;
  answerText: string; // 채점 후 보여줄 정답 표시용
  explain: string;
}

export interface DailySet {
  kidId: string;
  date: string; // YYYY-MM-DD (KST)
  subject: Subject;
  problems: Problem[];
  answers: (AnswerRecord | null)[];
  completedAt: string | null;
}

export interface DayResult {
  done: boolean;
  correct: number;
  total: number;
}

export type HistoryDay = Partial<Record<Subject, DayResult>>;
/** date(YYYY-MM-DD) → 과목별 결과 */
export type History = Record<string, HistoryDay>;

export interface WrongItem {
  date: string;
  subject: Subject;
  q: string;
  given: string;
  answerText: string;
  explain: string;
}

export const DEFAULT_SETTINGS: Settings = {
  kids: [],
  parentPin: "0000",
};

export const KID_EMOJIS = ["🦁", "🐰", "🐻", "🦊", "🐯", "🐼", "🐥", "🦄", "🐬", "🍀"];
