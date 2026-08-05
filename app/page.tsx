"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SUBJECT_EMOJI, SUBJECT_LABEL, Subject, SUBJECTS, gradeLabel } from "@/lib/types";

interface SubjectToday {
  assigned: number;
  answered: number;
  total: number;
  correct: number;
  done: boolean;
}

interface KidState {
  id: string;
  name: string;
  grade: number;
  emoji: string;
  perDay: Record<Subject, number>;
  today: Record<Subject, SubjectToday>;
  streak: number;
}

interface State {
  date: string;
  kids: KidState[];
  needsSetup: boolean;
}

function subjectDot(kid: KidState, s: Subject) {
  const t = kid.today[s];
  if (!t || t.assigned <= 0) return null;
  let text: string;
  if (t.done) text = `${SUBJECT_LABEL[s]} ✓`;
  else if (t.answered > 0) text = `${SUBJECT_LABEL[s]} ${t.answered}/${t.total}`;
  else text = `${SUBJECT_LABEL[s]} ${t.total}문제`;
  return (
    <span key={s} className={`dot ${s}`}>
      {SUBJECT_EMOJI[s]} {text}
    </span>
  );
}

export default function Home() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => {
        if (r.status === 401) {
          location.href = "/enter";
          return null;
        }
        return r.json();
      })
      .then((j) => j && setState(j))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <main className="container">
        <div className="loading">문제가 생겼어요. 새로고침 해주세요 🙏</div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="container">
        <div className="loading">
          <span className="spin">📚</span>
          <div style={{ marginTop: 10 }}>불러오는 중...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1 className="top-title">러브키즈 숙제방 💕</h1>
      <p className="top-sub">{state.date} · 오늘도 함께 공부해요!</p>

      {state.needsSetup ? (
        <div className="card center stack">
          <div style={{ fontSize: 48 }}>👋</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>처음 오셨네요!</div>
          <p className="muted">부모님 페이지에서 아이를 등록하면 시작할 수 있어요.</p>
          <Link href="/parent" className="btn btn-primary btn-block">
            부모님 설정으로 가기
          </Link>
        </div>
      ) : (
        <div className="stack">
          {state.kids.map((kid) => {
            const enabled = SUBJECTS.filter((s) => (kid.perDay[s] ?? 0) > 0);
            const allDone = enabled.length > 0 && enabled.every((s) => kid.today[s]?.done);
            return (
              <Link key={kid.id} href={`/kid/${kid.id}`} className="card kid-card">
                <div className="row">
                  <div className="kid-emoji">{kid.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div className="row">
                      <span className="kid-name">{kid.name}</span>
                      <span className="badge">{gradeLabel(kid.grade)}</span>
                      {kid.streak > 0 && <span className="badge fire">🔥 {kid.streak}일 연속</span>}
                    </div>
                    <div className="subject-dots">
                      {allDone ? (
                        <span className="dot math">오늘 숙제 끝! 🎉</span>
                      ) : (
                        SUBJECTS.map((s) => subjectDot(kid, s))
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, color: "#d9d2de" }}>›</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="center" style={{ marginTop: 28 }}>
        <Link href="/parent" className="badge">
          👨‍👩‍👧 부모님 페이지
        </Link>
      </p>
    </main>
  );
}
