"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  History,
  Kid,
  KID_EMOJIS,
  Subject,
  SUBJECT_EMOJI,
  SUBJECT_LABEL,
  SUBJECTS,
  WrongItem,
} from "@/lib/types";

interface SubjectToday {
  assigned: number;
  answered: number;
  total: number;
  correct: number;
  done: boolean;
}

interface ParentKid extends Kid {
  history: History;
  wrong: WrongItem[];
  today: Record<Subject, SubjectToday>;
  streak: number;
}

interface ParentData {
  date: string;
  kids: ParentKid[];
  bank: Record<Subject, Record<number, number>>;
  storage: "kv" | "file" | "memory";
}

type Tab = "today" | "cal" | "wrong" | "settings";

const pad = (n: number) => String(n).padStart(2, "0");

function newKid(): Kid {
  return {
    id: "",
    name: "",
    grade: 1,
    emoji: KID_EMOJIS[Math.floor(Math.random() * KID_EMOJIS.length)],
    perDay: { ko: 5, en: 5, math: 10 },
  };
}

export default function ParentPage() {
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [data, setData] = useState<ParentData | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [busy, setBusy] = useState(false);

  // 설정 편집 상태
  const [editKids, setEditKids] = useState<Kid[]>([]);
  const [newPin, setNewPin] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  // 달력/오답 상태
  const [selKid, setSelKid] = useState<string>("");
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  async function load(usePin: string): Promise<boolean> {
    const res = await fetch("/api/parent/data", { headers: { "x-pin": usePin } }).catch(() => null);
    if (!res) return false;
    if (res.status === 401) {
      location.href = "/enter";
      return false;
    }
    if (!res.ok) return false;
    const j = (await res.json()) as ParentData;
    setData(j);
    setEditKids(j.kids.map(({ id, name, grade, emoji, perDay }) => ({ id, name, grade, emoji, perDay })));
    if (!selKid && j.kids.length > 0) setSelKid(j.kids[0].id);
    if (j.kids.length === 0) setTab("settings");
    return true;
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("parentPin");
    if (saved) {
      load(saved).then((ok) => {
        if (ok) setPin(saved);
        else sessionStorage.removeItem("parentPin");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinInput || busy) return;
    setBusy(true);
    setPinError("");
    const ok = await load(pinInput);
    setBusy(false);
    if (ok) {
      setPin(pinInput);
      sessionStorage.setItem("parentPin", pinInput);
    } else {
      setPinError("PIN이 맞지 않아요. (처음이라면 0000)");
    }
  }

  async function saveSettings() {
    if (busy) return;
    for (const k of editKids) {
      if (!k.name.trim()) {
        setSaveMsg("이름이 비어 있는 아이가 있어요.");
        return;
      }
    }
    setBusy(true);
    setSaveMsg("");
    const body: Record<string, unknown> = { pin, kids: editKids };
    if (newPin) body.newPin = newPin;
    const res = await fetch("/api/parent/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const usePin = newPin || pin;
      if (newPin) {
        setPin(newPin);
        sessionStorage.setItem("parentPin", newPin);
        setNewPin("");
      }
      setSaveMsg("저장했어요! ✅");
      await load(usePin);
    } else {
      const j = await res?.json().catch(() => null);
      setSaveMsg(j?.error === "bad-pin" ? "새 PIN은 4~8자리 숫자여야 해요." : "저장에 실패했어요.");
    }
  }

  /* ---------- PIN 화면 ---------- */
  if (!pin || !data) {
    return (
      <main className="container" style={{ maxWidth: 420 }}>
        <h1 className="top-title">부모님 페이지 👨‍👩‍👧</h1>
        <p className="top-sub">PIN을 입력해 주세요 (처음이라면 0000)</p>
        <form className="card stack" onSubmit={tryPin}>
          <input
            className="short-input"
            style={{ textAlign: "center", letterSpacing: 6 }}
            type="password"
            inputMode="numeric"
            placeholder="••••"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
            autoFocus
          />
          {pinError && (
            <p className="center" style={{ color: "var(--bad)", fontSize: 14, fontWeight: 700 }}>
              {pinError}
            </p>
          )}
          <button className="btn btn-primary btn-block" disabled={busy}>
            확인
          </button>
          <Link href="/" className="btn btn-ghost btn-block">
            ← 홈으로
          </Link>
        </form>
      </main>
    );
  }

  const kid = data.kids.find((k) => k.id === selKid) ?? data.kids[0];
  const todayStr = data.date;

  /* ---------- 달력 셀 계산 ---------- */
  function calCells() {
    if (!kid) return [];
    const first = new Date(ym.y, ym.m - 1, 1);
    const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
    const startDay = first.getDay(); // 0=일
    const enabled = SUBJECTS.filter((s) => (kid.perDay[s] ?? 0) > 0);
    const cells: { day: number; cls: string; label: string }[] = [];
    for (let i = 0; i < startDay; i++) cells.push({ day: 0, cls: "", label: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${ym.y}-${pad(ym.m)}-${pad(d)}`;
      const isFuture = dateStr > todayStr;
      const h = kid.history[dateStr];
      const doneCnt = enabled.filter((s) => h?.[s]?.done).length;
      let cls = "";
      let label = "";
      if (!isFuture && enabled.length > 0) {
        if (doneCnt === enabled.length) {
          cls = "full";
          label = "🎉";
        } else if (doneCnt > 0) {
          cls = "part";
          label = `${doneCnt}/${enabled.length}`;
        } else {
          cls = "none";
        }
      }
      if (dateStr === todayStr) cls += " today";
      cells.push({ day: d, cls, label });
    }
    return cells;
  }

  return (
    <main className="container">
      <div className="spread" style={{ padding: "8px 0 14px" }}>
        <div className="row">
          <Link href="/" className="close-btn">
            ←
          </Link>
          <span style={{ fontSize: 19, fontWeight: 800 }}>부모님 페이지</span>
        </div>
        <span className="badge">{todayStr}</span>
      </div>

      {data.storage === "memory" && (
        <div className="warn" style={{ marginBottom: 14 }}>
          ⚠️ <b>저장소가 아직 연결되지 않았습니다.</b> 지금은 아이 등록·학습 기록이 잠시 뒤 사라집니다.
          <br />
          Vercel 프로젝트 → <b>Storage</b> 탭 → <b>Upstash for Redis</b>(무료)를 만들어 이 프로젝트에
          연결하고, <b>Deployments</b> 탭에서 <b>Redeploy</b>를 한 번 해주세요. 그 뒤부터 기록이 계속
          남습니다.
        </div>
      )}

      <div className="tabs">
        {(
          [
            ["today", "오늘"],
            ["cal", "달력"],
            ["wrong", "오답 노트"],
            ["settings", "설정"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {/* ---------- 오늘 ---------- */}
      {tab === "today" && (
        <div className="stack">
          {data.kids.length === 0 && (
            <div className="card center muted">설정 탭에서 아이를 먼저 등록해 주세요.</div>
          )}
          {data.kids.map((k) => (
            <div key={k.id} className="card">
              <div className="row" style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 26 }}>{k.emoji}</span>
                <b>{k.name}</b>
                <span className="badge">{k.grade}학년</span>
                {k.streak > 0 && <span className="badge fire">🔥 {k.streak}일</span>}
              </div>
              <div className="stack" style={{ gap: 6 }}>
                {SUBJECTS.filter((s) => (k.perDay[s] ?? 0) > 0).map((s) => {
                  const t = k.today[s];
                  let status: React.ReactNode;
                  if (t.done)
                    status = (
                      <b style={{ color: "var(--good)" }}>
                        완료 · {t.correct}/{t.total} 정답
                      </b>
                    );
                  else if (t.answered > 0)
                    status = (
                      <b style={{ color: "#c98a00" }}>
                        푸는 중 {t.answered}/{t.total}
                      </b>
                    );
                  else status = <span className="muted">아직 시작 안 함</span>;
                  return (
                    <div key={s} className="spread" style={{ fontSize: 14.5 }}>
                      <span>
                        {SUBJECT_EMOJI[s]} {SUBJECT_LABEL[s]} ({t.assigned}문제)
                      </span>
                      {status}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- 달력 ---------- */}
      {tab === "cal" && kid && (
        <div>
          <div className="chips">
            {data.kids.map((k) => (
              <button
                key={k.id}
                className={`chip ${k.id === kid.id ? "active" : ""}`}
                onClick={() => setSelKid(k.id)}
              >
                {k.emoji} {k.name}
              </button>
            ))}
          </div>
          <div className="card">
            <div className="spread" style={{ marginBottom: 10 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: "6px 14px" }}
                onClick={() => setYm(({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }))}
              >
                ←
              </button>
              <b>
                {ym.y}년 {ym.m}월
              </b>
              <button
                className="btn btn-ghost"
                style={{ padding: "6px 14px" }}
                onClick={() => setYm(({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }))}
              >
                →
              </button>
            </div>
            <table className="cal">
              <thead>
                <tr>
                  {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                    <th key={d}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(calCells().length / 7) }, (_, w) => (
                  <tr key={w}>
                    {calCells()
                      .slice(w * 7, w * 7 + 7)
                      .map((c, i) => (
                        <td key={i}>
                          {c.day > 0 && (
                            <div className={`cal-day ${c.cls}`}>
                              <span>{c.day}</span>
                              {c.label && <span className="m">{c.label}</span>}
                            </div>
                          )}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
              🟢 모두 완료 · 🟡 일부 완료 · ⚪ 안 함 (오늘은 테두리 표시)
            </p>
          </div>
        </div>
      )}

      {/* ---------- 오답 노트 ---------- */}
      {tab === "wrong" && kid && (
        <div>
          <div className="chips">
            {data.kids.map((k) => (
              <button
                key={k.id}
                className={`chip ${k.id === kid.id ? "active" : ""}`}
                onClick={() => setSelKid(k.id)}
              >
                {k.emoji} {k.name}
              </button>
            ))}
          </div>
          <div className="card">
            {kid.wrong.length === 0 ? (
              <p className="center muted" style={{ padding: 20 }}>
                아직 틀린 문제가 없어요! 👏
              </p>
            ) : (
              kid.wrong.slice(0, 60).map((w, i) => (
                <div key={i} className="wrong-item">
                  <div className="wrong-meta">
                    {w.date} · {SUBJECT_EMOJI[w.subject]} {SUBJECT_LABEL[w.subject]}
                  </div>
                  <div className="wrong-q">{w.q}</div>
                  <div className="wrong-ans">
                    <span style={{ color: "var(--bad)" }}>아이 답: {w.given || "(빈칸)"}</span>
                    {" → "}
                    <span style={{ color: "var(--good)", fontWeight: 700 }}>정답: {w.answerText}</span>
                  </div>
                  {w.explain && (
                    <div className="muted" style={{ marginTop: 3, fontSize: 13 }}>
                      💡 {w.explain}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------- 설정 ---------- */}
      {tab === "settings" && (
        <div className="stack">
          <div className="card stack">
            <div className="section-title">아이 관리</div>
            {editKids.map((k, i) => (
              <div key={i} className="kid-edit">
                <div className="spread">
                  <div className="emoji-pick">
                    {KID_EMOJIS.slice(0, 6).map((e) => (
                      <button
                        key={e}
                        type="button"
                        className={k.emoji === e ? "on" : ""}
                        onClick={() =>
                          setEditKids((ks) => ks.map((x, j) => (j === i ? { ...x, emoji: e } : x)))
                        }
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="badge"
                    onClick={() => setEditKids((ks) => ks.filter((_, j) => j !== i))}
                  >
                    삭제 ✕
                  </button>
                </div>
                <div className="row">
                  <input
                    className="input"
                    placeholder="이름"
                    value={k.name}
                    onChange={(e) =>
                      setEditKids((ks) => ks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <select
                    className="input"
                    style={{ width: 110 }}
                    value={k.grade}
                    onChange={(e) =>
                      setEditKids((ks) =>
                        ks.map((x, j) => (j === i ? { ...x, grade: Number(e.target.value) } : x)),
                      )
                    }
                  >
                    {[1, 2, 3, 4, 5, 6].map((g) => (
                      <option key={g} value={g}>
                        {g}학년
                      </option>
                    ))}
                  </select>
                </div>
                <div className="per-day-grid">
                  {SUBJECTS.map((s) => (
                    <label key={s}>
                      {SUBJECT_EMOJI[s]} {SUBJECT_LABEL[s]} 문제 수
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={30}
                        value={k.perDay[s]}
                        onChange={(e) =>
                          setEditKids((ks) =>
                            ks.map((x, j) =>
                              j === i
                                ? { ...x, perDay: { ...x.perDay, [s]: Number(e.target.value) } }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 12 }}>
                  0으로 두면 그 과목은 숙제에서 빠져요.
                </p>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={() => setEditKids((ks) => [...ks, newKid()])}>
              + 아이 추가
            </button>

            <div className="section-title">PIN 변경 (선택)</div>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              placeholder="새 PIN (4~8자리 숫자, 비우면 유지)"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />

            <button className="btn btn-primary btn-block" onClick={saveSettings} disabled={busy}>
              저장하기
            </button>
            {saveMsg && (
              <p className="center" style={{ fontSize: 14, fontWeight: 700 }}>
                {saveMsg}
              </p>
            )}
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 8 }}>
              문제은행 보유량
            </div>
            <table className="bank-table">
              <thead>
                <tr>
                  <th>과목</th>
                  {[1, 2, 3, 4, 5, 6].map((g) => (
                    <th key={g}>{g}학년</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map((s) => (
                  <tr key={s}>
                    <td>
                      {SUBJECT_EMOJI[s]} {SUBJECT_LABEL[s]}
                    </td>
                    {[1, 2, 3, 4, 5, 6].map((g) => (
                      <td key={g}>{data.bank[s]?.[g] ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
              수학 연산 문제는 무한 자동 생성이라 표에 포함되지 않아요. 문제가 부족해지면 Claude Code에게
              &quot;문제은행 리필해줘&quot;라고 요청하세요.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
