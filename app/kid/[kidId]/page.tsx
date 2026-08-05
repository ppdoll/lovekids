"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SUBJECT_EMOJI, SUBJECT_LABEL, Subject, SUBJECTS, gradeLabel } from "@/lib/types";

interface SubjectToday {
  assigned: number;
  answered: number;
  total: number;
  correct: number;
  done: boolean;
  wrongTotal: number;
  retryLeft: number;
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

type Role = "parent" | "kid";

export default function KidPage() {
  const params = useParams<{ kidId: string }>();
  const [kid, setKid] = useState<KidState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [role, setRole] = useState<Role>("parent");

  useEffect(() => {
    fetch("/api/state")
      .then((r) => {
        if (r.status === 401) {
          location.href = "/enter";
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (j) {
          setKid(j.kids.find((k: KidState) => k.id === params.kidId) ?? null);
          if (j.role) setRole(j.role);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [params.kidId]);

  if (!loaded) {
    return (
      <main className="container">
        <div className="loading">
          <span className="spin">🎒</span>
          <div style={{ marginTop: 10 }}>준비하는 중...</div>
        </div>
      </main>
    );
  }

  if (!kid) {
    return (
      <main className="container center">
        <div className="loading">아이 정보를 찾을 수 없어요.</div>
        <Link href="/" className="btn btn-ghost">
          ← 홈으로
        </Link>
      </main>
    );
  }

  const enabled = SUBJECTS.filter((s) => (kid.perDay[s] ?? 0) > 0);
  const allDone = enabled.length > 0 && enabled.every((s) => kid.today[s]?.done);

  return (
    <main className="container">
      <div className="row" style={{ padding: "8px 0 16px" }}>
        {/* 아이 링크로 들어온 경우엔 홈에도 자기밖에 없으므로 뒤로 버튼을 숨긴다 */}
        {role === "parent" && (
          <Link href="/" className="close-btn">
            ←
          </Link>
        )}
        <div className="kid-emoji" style={{ width: 52, height: 52, fontSize: 30 }}>
          {kid.emoji}
        </div>
        <div>
          <div className="kid-name">{kid.name}</div>
          <div className="row" style={{ gap: 6 }}>
            <span className="badge">{gradeLabel(kid.grade)}</span>
            {kid.streak > 0 && <span className="badge fire">🔥 {kid.streak}일 연속</span>}
          </div>
        </div>
      </div>

      {allDone && (
        <div className="card center" style={{ marginBottom: 14, background: "#fffbe8" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>오늘 숙제를 모두 끝냈어요!</div>
          <div className="muted">정말 멋져요. 내일 또 만나요!</div>
        </div>
      )}

      <div className="stack">
        {enabled.map((s) => {
          const t = kid.today[s];
          let desc: string;
          let btnLabel: string;
          if (t.done) {
            desc = `완료! ${t.correct}/${t.total} 맞혔어요`;
            btnLabel = "완료 ✓";
          } else if (t.answered > 0) {
            desc = `${t.answered}/${t.total} 푸는 중`;
            btnLabel = "이어서 풀기";
          } else {
            desc = `오늘 ${t.total}문제`;
            btnLabel = "시작하기!";
          }
          // 다 풀고 나서만 보여준다. 푸는 중에 눈에 띄면 지금 풀 문제에 집중하기 어렵다.
          const showRetry = t.done && (t.wrongTotal ?? 0) > 0;
          return (
            <div key={s} className="stack" style={{ gap: 0 }}>
              <div className="card subject-card">
                <div className={`subject-icon ${s}`}>{SUBJECT_EMOJI[s]}</div>
                <div style={{ flex: 1 }}>
                  <div className="subject-name">{SUBJECT_LABEL[s]}</div>
                  <div className="subject-desc">{desc}</div>
                </div>
                {t.done ? (
                  <span className="go-btn done">완료 ✓</span>
                ) : (
                  <Link href={`/kid/${kid.id}/quiz/${s}`} className={`go-btn ${s}`}>
                    {btnLabel}
                  </Link>
                )}
              </div>
              {showRetry &&
                (t.retryLeft > 0 ? (
                  <Link href={`/kid/${kid.id}/quiz/${s}?mode=retry`} className="retry-row">
                    <span className="retry-icon">🔁</span>
                    <span className="retry-text">
                      틀린 문제 다시 풀기
                      <span className="retry-sub">
                        {t.wrongTotal - t.retryLeft > 0
                          ? `${t.wrongTotal}개 중 ${t.retryLeft}개 남았어요`
                          : `${t.retryLeft}문제`}
                      </span>
                    </span>
                    <span className="retry-go">풀기 →</span>
                  </Link>
                ) : (
                  <div className="retry-row fixed">
                    <span className="retry-icon">🎯</span>
                    <span className="retry-text">
                      틀린 문제 {t.wrongTotal}개를 모두 고쳤어요!
                      <span className="retry-sub">복습까지 끝냈어요. 정말 잘했어요!</span>
                    </span>
                    <span className="retry-go done">완료 ✓</span>
                  </div>
                ))}
            </div>
          );
        })}
        {enabled.length === 0 && (
          <div className="card center muted">아직 설정된 과목이 없어요. 부모님께 말씀드려 주세요!</div>
        )}
      </div>

      {/* 부모가 자기 기기에서 아이 링크를 열었을 때 돌아갈 길 (아이 세션에서는 부모 페이지가 막혀 있다) */}
      {role === "kid" && (
        <p className="center" style={{ marginTop: 28 }}>
          <a href="/api/auth/logout" className="badge">
            👨‍👩‍👧 부모님이신가요?
          </a>
        </p>
      )}
    </main>
  );
}
