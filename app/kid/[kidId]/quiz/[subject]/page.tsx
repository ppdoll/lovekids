"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { SUBJECT_EMOJI, SUBJECT_LABEL, Subject } from "@/lib/types";

interface PublicProblem {
  id: string;
  type: "mc" | "short";
  q: string;
  choices?: string[];
  tag?: string;
}

interface AnswerRecord {
  given: string;
  correct: boolean;
  answerText: string;
  explain: string;
}

interface SetData {
  date: string;
  subject: Subject;
  total: number;
  problems: PublicProblem[];
  answers: (AnswerRecord | null)[];
  completedAt: string | null;
  combo: number;
  bestCombo: number;
  /** 문제 번호 → 다시 풀기 결과 */
  retry: Record<string, AnswerRecord>;
}

interface RetryRes {
  record: AnswerRecord;
  left: number;
  wrongTotal: number;
  fixed: number;
}

interface SubmitRes {
  record: AnswerRecord;
  answered: number;
  total: number;
  correctCount: number;
  done: boolean;
  combo: number;
  bestCombo: number;
}

/** 콤보 단계별 표시 (연속 정답이 쌓일수록 반응이 커진다) */
function comboLook(n: number): { emoji: string; label: string; cls: string } | null {
  if (n < 2) return null;
  if (n === 2) return { emoji: "✨", label: "2연속!", cls: "c2" };
  if (n === 3) return { emoji: "🔥", label: "3연속!", cls: "c3" };
  if (n === 4) return { emoji: "⚡", label: "4연속!", cls: "c4" };
  if (n <= 6) return { emoji: "🔥🔥", label: `${n}연속 불꽃!`, cls: "c5" };
  if (n <= 9) return { emoji: "🌟", label: `${n}연속 대단해요!`, cls: "c7" };
  return { emoji: "👑", label: `${n}연속 최고예요!`, cls: "c10" };
}

const COMBO_CHEER: Record<string, string> = {
  c2: "좋아요, 이어가 볼까요?",
  c3: "불이 붙었어요!",
  c4: "멈추지 말아요!",
  c5: "정말 잘하고 있어요!",
  c7: "이 정도면 고수예요!",
  c10: "믿을 수 없어요!",
};

const PRAISE_HIGH = ["완벽해요! 최고예요! 🏆", "우와, 다 맞혔어요! 천재인가요? ✨", "빈틈이 없네요! 대단해요! 💯"];
const PRAISE_MID = ["정말 잘했어요! 🎉", "멋져요! 조금만 더 하면 만점! 💪", "훌륭해요! 오늘도 성장했어요! 🌱"];
const PRAISE_LOW = ["끝까지 푼 게 제일 멋져요! 👏", "괜찮아요, 틀린 문제로 더 똑똑해져요! 🧠", "내일은 더 잘할 수 있어요! 화이팅! 🔥"];

const CONFETTI = ["🎉", "⭐", "💖", "🎈", "✨", "🍀"];

const RETRY_PRAISE_ALL = ["전부 고쳤어요! 이제 완전히 알아요! 🎯", "하나도 안 남았어요! 대단해요! 🏆"];
const RETRY_PRAISE_SOME = ["고친 만큼 실력이 늘었어요! 💪", "잘했어요! 남은 문제는 다음에 또 해볼까요? 🌱"];
const RETRY_PRAISE_NONE = ["해설을 잘 읽어봤나요? 다음에 다시 해봐요! 📖", "괜찮아요. 어려운 문제였어요! 🧠"];

const LOADING = (
  <main className="container">
    <div className="loading">
      <span className="spin">✏️</span>
      <div style={{ marginTop: 10 }}>문제를 준비하는 중...</div>
    </div>
  </main>
);

/** useSearchParams는 Suspense 경계 안에서 써야 한다 */
export default function QuizPage() {
  return <Suspense fallback={LOADING}>{<Quiz />}</Suspense>;
}

function Quiz() {
  const params = useParams<{ kidId: string; subject: string }>();
  const kidId = params.kidId;
  const subject = params.subject as Subject;
  /** 틀린 문제 다시 풀기 모드 (?mode=retry) */
  const isRetry = useSearchParams().get("mode") === "retry";

  const [data, setData] = useState<SetData | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"loading" | "question" | "feedback" | "finished">("loading");
  const [last, setLast] = useState<SubmitRes | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * 다시 풀 문제 번호 목록. 페이지를 열 때 한 번 정해두고 바꾸지 않는다 —
   * 푸는 도중에 목록이 줄어들면 화면이 앞뒤로 튀어 아이가 헷갈린다.
   */
  const [queue, setQueue] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [fixed, setFixed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/today?kid=${encodeURIComponent(kidId)}&subject=${subject}`)
      .then(async (r) => {
        if (r.status === 401) {
          location.href = "/enter";
          return null;
        }
        const j = await r.json();
        if (!r.ok) {
          setFailReason(j.error ?? "unknown");
          return null;
        }
        return j as SetData;
      })
      .then((j) => {
        if (!j) return;
        setData(j);
        setCombo(j.combo ?? 0);
        setBestCombo(j.bestCombo ?? 0);

        if (isRetry) {
          // 첫 시도에 틀렸고 아직 다시 풀어서 맞히지 못한 문제만 모은다
          const q = j.answers
            .map((a, i) => ({ a, i }))
            .filter(({ a, i }) => a && !a.correct && !j.retry?.[String(i)]?.correct)
            .map(({ i }) => i);
          setQueue(q);
          setPos(0);
          if (q.length === 0) {
            setPhase("finished");
          } else {
            setIdx(q[0]);
            setPhase("question");
          }
          return;
        }

        const firstOpen = j.answers.findIndex((a) => a === null);
        if (firstOpen === -1) {
          setPhase("finished");
        } else {
          setIdx(firstOpen);
          setPhase("question");
        }
      })
      .catch(() => setFailReason("network"));
  }, [kidId, subject, isRetry]);

  const answeredCount = data ? data.answers.filter(Boolean).length : 0;
  const correctCount = data ? data.answers.filter((a) => a?.correct).length : 0;

  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        emoji: CONFETTI[i % CONFETTI.length],
        left: Math.random() * 95,
        delay: Math.random() * 2,
      })),
    [],
  );

  async function submit(given: string) {
    if (!data || busy) return;
    setBusy(true);
    const res = await fetch(isRetry ? "/api/retry" : "/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kidId, subject, index: idx, given }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return;

    if (isRetry) {
      const j = (await res.json()) as RetryRes;
      setData({ ...data, retry: { ...data.retry, [String(idx)]: j.record } });
      if (j.record.correct) setFixed((n) => n + 1);
      // 다시 풀기에는 콤보를 붙이지 않는다. 콤보는 처음 풀 때의 기록이고,
      // 정답을 이미 본 문제로 기록을 쌓으면 의미가 없다.
      setLast({ record: j.record, answered: 0, total: 0, correctCount: 0, done: false, combo: 0, bestCombo: 0 });
      setPhase("feedback");
      return;
    }

    const j = (await res.json()) as SubmitRes;
    const answers = [...data.answers];
    answers[idx] = j.record;
    setData({ ...data, answers, completedAt: j.done ? new Date().toISOString() : data.completedAt });
    setCombo(j.combo);
    setBestCombo(j.bestCombo);
    setLast(j);
    setPhase("feedback");
  }

  function next() {
    if (!data) return;
    setInput("");
    setLast(null);

    if (isRetry) {
      const np = pos + 1;
      if (np >= queue.length) {
        setPhase("finished");
      } else {
        setPos(np);
        setIdx(queue[np]);
        setPhase("question");
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return;
    }

    const nextOpen = data.answers.findIndex((a) => a === null);
    if (nextOpen === -1) {
      setPhase("finished");
    } else {
      setIdx(nextOpen);
      setPhase("question");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  if (failReason) {
    const msg =
      failReason === "off"
        ? "오늘은 이 과목 숙제가 없어요! 😊"
        : failReason === "empty-bank"
          ? "문제은행을 준비하고 있어요. 조금만 기다려 주세요!"
          : failReason === "no-kid"
            ? "아이 정보를 찾을 수 없어요."
            : "문제를 불러오지 못했어요. 다시 시도해 주세요.";
    return (
      <main className="container center">
        <div className="loading">{msg}</div>
        <Link href={`/kid/${kidId}`} className="btn btn-ghost">
          ← 돌아가기
        </Link>
      </main>
    );
  }

  if (phase === "loading" || !data) return LOADING;

  if (isRetry && phase === "finished") {
    // 이번에 다시 풀기로 들어온 문제 수 (0이면 고칠 게 없어서 바로 이 화면)
    const tried = queue.length;
    const pool = tried === 0 || fixed === tried ? RETRY_PRAISE_ALL : fixed > 0 ? RETRY_PRAISE_SOME : RETRY_PRAISE_NONE;
    const praise = pool[Math.floor(Math.random() * pool.length)];
    return (
      <main className="container" style={{ maxWidth: 480 }}>
        <div className="card finish">
          {fixed === tried &&
            confetti.map((c, i) => (
              <span key={i} className="confetti" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s` }}>
                {c.emoji}
              </span>
            ))}
          <div className="finish-stars">{tried === 0 || fixed === tried ? "🎯" : "🔁"}</div>
          <div className="finish-score">
            {tried === 0 ? "다 고쳤어요!" : `${fixed} / ${tried}`}
          </div>
          <div className="finish-praise">{praise}</div>
          {tried > fixed && (
            <div className="finish-note">
              아직 못 고친 {tried - fixed}문제는 그대로 남겨뒀어요. 해설을 읽고 다시 도전해 보세요!
            </div>
          )}
          <div style={{ marginTop: 20 }}>
            <Link href={`/kid/${kidId}`} className="btn btn-primary btn-block">
              돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "finished") {
    const pct = data.total > 0 ? Math.round((correctCount / data.total) * 100) : 0;
    const stars = pct === 100 ? "⭐⭐⭐" : pct >= 70 ? "⭐⭐" : "⭐";
    const pool = pct === 100 ? PRAISE_HIGH : pct >= 70 ? PRAISE_MID : PRAISE_LOW;
    const praise = pool[Math.floor(Math.random() * pool.length)];
    const wrongCount = data.total - correctCount;
    return (
      <main className="container" style={{ maxWidth: 480 }}>
        <div className="card finish">
          {pct >= 60 &&
            confetti.map((c, i) => (
              <span
                key={i}
                className="confetti"
                style={{ left: `${c.left}%`, animationDelay: `${c.delay}s` }}
              >
                {c.emoji}
              </span>
            ))}
          <div className="finish-stars">{stars}</div>
          <div className="finish-score">
            {correctCount} / {data.total}
          </div>
          <div className="finish-praise">{praise}</div>
          {bestCombo >= 2 && (
            <div className="finish-combo">
              {bestCombo >= 10 ? "👑" : bestCombo >= 7 ? "🌟" : bestCombo >= 5 ? "🔥🔥" : "🔥"} 최고 연속{" "}
              <b>{bestCombo}문제</b>
              {bestCombo === data.total && data.total >= 3 && " — 전부 한 번에! 완벽해요!"}
            </div>
          )}
          {wrongCount > 0 && (
            <div className="finish-note">틀린 문제 {wrongCount}개는 오답 노트에 저장했어요.</div>
          )}
          <div style={{ marginTop: 20 }} className="stack">
            {/* 다 풀고 나서 바로 복습할 수 있게 여기에도 길을 둔다 */}
            {wrongCount > 0 && (
              <Link href={`/kid/${kidId}/quiz/${subject}?mode=retry`} className="btn btn-retry btn-block">
                🔁 틀린 문제 {wrongCount}개 다시 풀기
              </Link>
            )}
            <Link href={`/kid/${kidId}`} className={`btn btn-block ${wrongCount > 0 ? "btn-ghost" : "btn-primary"}`}>
              돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const p = data.problems[idx];
  // 진행 표시: 보통은 푼 문제 수, 다시 풀기에서는 이번에 처리한 문제 수
  const doneCount = isRetry ? pos + (phase === "feedback" ? 1 : 0) : answeredCount;
  const barTotal = isRetry ? queue.length : data.total;
  const isLast = isRetry ? pos + 1 >= queue.length : data.answers.every(Boolean);

  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <div className="quiz-top">
        <Link href={`/kid/${kidId}`} className="close-btn">
          ✕
        </Link>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(doneCount / barTotal) * 100}%` }} />
        </div>
        <span className="progress-label">
          {isRetry ? "🔁" : SUBJECT_EMOJI[subject]} {doneCount}/{barTotal}
        </span>
      </div>

      {isRetry && (
        <div className="retry-banner">
          🔁 <b>틀린 문제 다시 풀기</b> — 아까 틀린 문제만 모았어요
        </div>
      )}

      {/* 진행 중 콤보 표시 — 지금 몇 개 연속으로 맞혔는지 계속 보인다 */}
      {(() => {
        if (isRetry) return null; // 다시 풀기에는 콤보를 쓰지 않는다
        const look = comboLook(combo);
        if (!look) return null;
        return (
          <div className={`combo-bar ${look.cls}`} key={combo}>
            <span className="combo-emoji">{look.emoji}</span>
            <b>{look.label}</b>
            <span className="combo-flames">
              {Array.from({ length: Math.min(combo, 10) }, (_, i) => (
                <i key={i} />
              ))}
            </span>
          </div>
        );
      })()}

      {phase === "question" && (
        <div className="card question-card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            {p.tag ? <span className="q-tag">{p.tag}</span> : <span />}
            <span className="muted" style={{ fontSize: 12 }}>
              {/* 다시 풀기에서도 원래 문제 번호를 보여준다 — 아이가 어느 문제였는지 알아볼 수 있게 */}
              {idx + 1}번 · {SUBJECT_LABEL[subject]}
            </span>
          </div>
          <div className="q-text">{p.q}</div>

          {p.type === "mc" && p.choices ? (
            <div className="choices">
              {p.choices.map((c, i) => (
                <button key={i} className="choice" disabled={busy} onClick={() => submit(String(i))}>
                  <span className="choice-num">{i + 1}</span>
                  <span>{c}</span>
                </button>
              ))}
            </div>
          ) : (
            <form
              className="short-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) submit(input.trim());
              }}
            >
              <input
                ref={inputRef}
                className="short-input"
                placeholder="정답을 입력하세요"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
                autoComplete="off"
              />
              <button className="btn btn-primary" disabled={busy || !input.trim()}>
                확인
              </button>
            </form>
          )}
        </div>
      )}

      {phase === "feedback" && last && (
        <div className="card feedback">
          <div className="feedback-mark">{last.record.correct ? (isRetry ? "🎯" : "⭕") : "❌"}</div>
          <div className={`feedback-title ${last.record.correct ? "good" : "bad"}`}>
            {last.record.correct
              ? isRetry
                ? "이번엔 맞혔어요!"
                : "정답이에요!"
              : isRetry
                ? "아직 아니에요"
                : "아쉬워요!"}
          </div>

          {isRetry && !last.record.correct && (
            <div className="retry-keep">해설을 읽어보고 다음에 또 도전해요. 이 문제는 남겨둘게요.</div>
          )}

          {/* 콤보 축하 / 끊겼을 때 다시 시작 안내 */}
          {(() => {
            if (last.record.correct) {
              const look = comboLook(last.combo);
              if (!look) return null;
              return (
                <div className={`combo-pop ${look.cls}`}>
                  <span className="combo-pop-emoji">{look.emoji}</span>
                  <b>{look.label}</b>
                  <span className="combo-pop-cheer">{COMBO_CHEER[look.cls]}</span>
                </div>
              );
            }
            // 콤보가 2 이상 쌓여 있다가 끊긴 경우에만 알려준다
            if (last.bestCombo >= 2) {
              return (
                <div className="combo-break">
                  연속 기록이 끊겼어요. 다시 쌓아볼까요? (최고 {last.bestCombo}연속)
                </div>
              );
            }
            return null;
          })()}

          {!last.record.correct && (
            <div className="feedback-answer">
              정답: <b>{last.record.answerText}</b>
            </div>
          )}
          {last.record.explain && <div className="feedback-explain">💡 {last.record.explain}</div>}
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-primary btn-block" onClick={next}>
              {isLast ? "결과 보기 🎉" : "다음 문제 →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
