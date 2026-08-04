"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

export default function QuizPage() {
  const params = useParams<{ kidId: string; subject: string }>();
  const kidId = params.kidId;
  const subject = params.subject as Subject;

  const [data, setData] = useState<SetData | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"loading" | "question" | "feedback" | "finished">("loading");
  const [last, setLast] = useState<SubmitRes | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
        const firstOpen = j.answers.findIndex((a) => a === null);
        if (firstOpen === -1) {
          setPhase("finished");
        } else {
          setIdx(firstOpen);
          setPhase("question");
        }
      })
      .catch(() => setFailReason("network"));
  }, [kidId, subject]);

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
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kidId, subject, index: idx, given }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return;
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
    const nextOpen = data.answers.findIndex((a) => a === null);
    setInput("");
    setLast(null);
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

  if (phase === "loading" || !data) {
    return (
      <main className="container">
        <div className="loading">
          <span className="spin">✏️</span>
          <div style={{ marginTop: 10 }}>문제를 준비하는 중...</div>
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
          <div style={{ marginTop: 20 }}>
            <Link href={`/kid/${kidId}`} className="btn btn-primary btn-block">
              돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const p = data.problems[idx];

  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <div className="quiz-top">
        <Link href={`/kid/${kidId}`} className="close-btn">
          ✕
        </Link>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${(answeredCount / data.total) * 100}%` }}
          />
        </div>
        <span className="progress-label">
          {SUBJECT_EMOJI[subject]} {answeredCount}/{data.total}
        </span>
      </div>

      {/* 진행 중 콤보 표시 — 지금 몇 개 연속으로 맞혔는지 계속 보인다 */}
      {(() => {
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
          <div className="feedback-mark">{last.record.correct ? "⭕" : "❌"}</div>
          <div className={`feedback-title ${last.record.correct ? "good" : "bad"}`}>
            {last.record.correct ? "정답이에요!" : "아쉬워요!"}
          </div>

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
              {data.answers.every(Boolean) ? "결과 보기 🎉" : "다음 문제 →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
