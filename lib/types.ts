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

export interface Kid {
  id: string;
  name: string;
  grade: number; // 1~6
  emoji: string;
  perDay: Record<Subject, number>; // 과목별 하루 문제 수 (0이면 과목 끔)
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
