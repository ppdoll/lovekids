"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ALL_GRADES,
  CalcConfig,
  DEFAULT_CALC,
  gradeLabel,
  gradeShort,
  History,
  Kid,
  KID_EMOJIS,
  MUL_TABLES,
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
  accessToken?: string;
}

interface ParentData {
  date: string;
  kids: ParentKid[];
  bank: Record<Subject, Record<number, number>>;
  storage: "kv" | "file" | "memory";
  storageVia?: string | null;
  storageEnv?: string[];
  storageError?: string | null;
  onVercel?: boolean;
  googleEnabled?: boolean;
  account?: { email?: string; name?: string } | null;
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
    calc: structuredClone(DEFAULT_CALC),
  };
}

/** 연산 설정을 요약해 한 줄로 (설정을 펼치지 않아도 뭘 고른 상태인지 보이도록) */
function calcSummary(c: CalcConfig): string {
  if (c.mode === "auto") return "학년에 맞게 자동";
  const parts: string[] = [];
  if (c.add.on) parts.push(`＋ ${c.add.digits}자리${c.add.carry ? "·올림" : "·올림없이"}`);
  if (c.sub.on) parts.push(`－ ${c.sub.digits}자리${c.sub.digits > 1 ? (c.sub.borrow ? "·빌려주기" : "·빌려주기없이") : ""}`);
  if (c.mul.on) parts.push(`× ${c.mul.tables.join("·")}단`);
  if (c.div.on) parts.push(`÷ ${c.div.remainder ? "나머지 있음" : "딱 나눠짐"}`);
  if (parts.length === 0) return "고른 연산이 없어 학년 자동으로 나갑니다";
  return parts.join("  /  ") + (c.includeWord ? "  + 문장제" : "");
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
  const [openCalc, setOpenCalc] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(5);
  const [linkMsg, setLinkMsg] = useState<Record<string, string>>({});

  /** 아이 전용 접속 링크 발급 / 폐기 */
  async function kidLink(kidId: string, action: "issue" | "revoke") {
    if (action === "revoke" && !confirm("이 아이의 접속 링크를 없앨까요?\n아이가 지금 쓰던 링크로는 못 들어옵니다.")) {
      return;
    }
    setLinkMsg((m) => ({ ...m, [kidId]: "" }));
    const res = await fetch("/api/parent/kid-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, kidId, action }),
    }).catch(() => null);
    if (res?.ok) {
      setLinkMsg((m) => ({ ...m, [kidId]: action === "issue" ? "새 링크를 만들었어요 ✅" : "링크를 없앴어요" }));
      await load(pin);
    } else {
      setLinkMsg((m) => ({ ...m, [kidId]: "실패했어요. 다시 시도해 주세요" }));
    }
  }

  async function copyLink(url: string, kidId: string) {
    try {
      await navigator.clipboard.writeText(url);
      setLinkMsg((m) => ({ ...m, [kidId]: "링크를 복사했어요 ✅" }));
    } catch {
      setLinkMsg((m) => ({ ...m, [kidId]: "복사가 안 됐어요. 링크를 길게 눌러 복사해 주세요" }));
    }
  }

  /** 오늘 숙제 리셋 / 문제 추가 */
  async function setAction(kidId: string, subject: Subject, action: "reset" | "add", hasProgress = false) {
    const tag = `${kidId}:${subject}`;
    if (actionBusy) return;
    if (action === "reset") {
      const msg = hasProgress
        ? "오늘 푼 내용을 지우고 새 문제로 다시 시작할까요?\n(오답 노트는 그대로 남습니다)"
        : "오늘 문제를 새로 뽑고 문제 수를 기본값으로 되돌릴까요?";
      if (!confirm(msg)) return;
    }
    setActionBusy(tag);
    setActionMsg((m) => ({ ...m, [tag]: "" }));
    const res = await fetch("/api/parent/set-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, kidId, subject, action, count: addCount }),
    }).catch(() => null);
    setActionBusy(null);

    if (res?.ok) {
      const j = await res.json().catch(() => ({}));
      setActionMsg((m) => ({
        ...m,
        [tag]: action === "reset" ? "새 문제로 초기화했어요 ✅" : `${j.added ?? addCount}문제 추가했어요 ✅`,
      }));
      await load(pin);
    } else {
      const j = await res?.json().catch(() => null);
      setActionMsg((m) => ({
        ...m,
        [tag]: j?.error === "no-more" ? "더 낼 문제가 없어요" : "실패했어요. 다시 시도해 주세요",
      }));
    }
  }

  const setCalc = (i: number, patch: (c: CalcConfig) => CalcConfig) =>
    setEditKids((ks) =>
      ks.map((k, j) => (j === i ? { ...k, calc: patch(k.calc ?? structuredClone(DEFAULT_CALC)) } : k)),
    );

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
    // calc(연산 설정)를 빼먹으면 저장할 때마다 설정이 조용히 초기화된다
    setEditKids(
      j.kids.map(({ id, name, grade, emoji, perDay, calc }) => ({
        id,
        name,
        grade,
        emoji,
        perDay,
        calc: calc ?? structuredClone(DEFAULT_CALC),
      })),
    );
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
  const origin = typeof window === "undefined" ? "" : window.location.origin;

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
        <div className="row" style={{ gap: 6 }}>
          <span className="badge">{todayStr}</span>
          {data.googleEnabled && (
            <a href="/api/auth/logout" className="badge" title={data.account?.email ?? ""}>
              로그아웃
            </a>
          )}
        </div>
      </div>
      {data.googleEnabled && data.account?.email && (
        <p className="muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 12 }}>
          {data.account.email} 계정으로 로그인됨
        </p>
      )}

      {data.storage === "memory" && (
        <div className="warn" style={{ marginBottom: 14 }}>
          ⚠️ <b>저장소가 아직 연결되지 않았습니다.</b> 지금은 아이 등록·학습 기록이 잠시 뒤 사라집니다.
          <br />
          {(data.storageEnv?.length ?? 0) === 0 ? (
            <>
              저장소 환경변수가 <b>하나도 안 보입니다.</b> Upstash를 이미 연결하셨다면 적용이 안 된
              상태예요 — Vercel <b>Deployments</b> 탭 → 맨 위 배포의 <b>⋯</b> → <b>Redeploy</b>를 눌러
              주세요. 환경변수는 재배포해야 반영됩니다.
            </>
          ) : (
            <>
              환경변수는 있는데 짝이 맞는 접속 정보를 못 찾았습니다. 아래 이름을 알려주시면 맞춰
              드릴게요.
              <br />
              <code style={{ fontSize: 12, wordBreak: "break-all" }}>
                {data.storageEnv!.join(", ")}
              </code>
            </>
          )}
        </div>
      )}

      {data.storage === "kv" && data.storageError && (
        <div className="warn" style={{ marginBottom: 14 }}>
          ⚠️ <b>저장소에 쓰지 못했습니다.</b> {data.storageError}
          <br />
          Upstash 데이터베이스가 살아 있는지, 무료 한도를 넘지 않았는지 확인해 주세요.
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
          {data.kids.length > 0 && (
            <div className="add-count-bar">
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>
                문제를 더 낼 때 개수
              </span>
              <div className="row" style={{ gap: 6 }}>
                {[3, 5, 10].map((n) => (
                  <button
                    key={n}
                    className={`chip ${addCount === n ? "active" : ""}`}
                    style={{ padding: "5px 14px", fontSize: 13 }}
                    onClick={() => setAddCount(n)}
                  >
                    {n}문제
                  </button>
                ))}
              </div>
            </div>
          )}
          {data.kids.map((k) => (
            <div key={k.id} className="card">
              <div className="row" style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 26 }}>{k.emoji}</span>
                <b>{k.name}</b>
                <span className="badge">{gradeLabel(k.grade)}</span>
                {k.streak > 0 && <span className="badge fire">🔥 {k.streak}일</span>}
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {SUBJECTS.filter((s) => (k.perDay[s] ?? 0) > 0).map((s) => {
                  const t = k.today[s];
                  const tag = `${k.id}:${s}`;
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
                    <div key={s} className="today-row">
                      <div className="spread" style={{ fontSize: 14.5 }}>
                        <span>
                          {SUBJECT_EMOJI[s]} {SUBJECT_LABEL[s]} ({t.total}문제
                          {/* 문제를 더 냈으면 기본값과 달라지므로 표시해 준다 */}
                          {t.total !== t.assigned && (
                            <span className="muted" style={{ fontSize: 12 }}> · 기본 {t.assigned}</span>
                          )}
                          )
                        </span>
                        {status}
                      </div>
                      <div className="row" style={{ gap: 6, marginTop: 6 }}>
                        <button
                          className="mini-btn"
                          disabled={actionBusy === tag}
                          onClick={() => setAction(k.id, s, "add")}
                        >
                          + {addCount}문제 더
                        </button>
                        {/* 문제를 잘못 추가했을 때 되돌리는 유일한 방법이므로 항상 누를 수 있어야 한다 */}
                        <button
                          className="mini-btn danger"
                          disabled={actionBusy === tag}
                          onClick={() => setAction(k.id, s, "reset", t.answered > 0 || t.done)}
                        >
                          다시 시작
                        </button>
                        {actionMsg[tag] && <span className="mini-msg">{actionMsg[tag]}</span>}
                      </div>
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
                    {ALL_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {gradeLabel(g)}
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

                {/* ── 수학 연산 설정 ── */}
                <div className="calc-box">
                  <button
                    type="button"
                    className="calc-head"
                    onClick={() => setOpenCalc(openCalc === i ? null : i)}
                  >
                    <span>🧮 수학 연산 설정</span>
                    <span className="calc-arrow">{openCalc === i ? "접기 ▲" : "고치기 ▼"}</span>
                  </button>
                  <div className="calc-sum">{calcSummary(k.calc ?? DEFAULT_CALC)}</div>

                  {openCalc === i &&
                    (() => {
                      const c = k.calc ?? DEFAULT_CALC;
                      return (
                        <div className="stack" style={{ gap: 12, marginTop: 12 }}>
                          <div className="chips" style={{ marginBottom: 0 }}>
                            {(
                              [
                                ["auto", "학년에 맞게 자동"],
                                ["custom", "직접 고르기"],
                              ] as ["auto" | "custom", string][]
                            ).map(([m, label]) => (
                              <button
                                key={m}
                                type="button"
                                className={`chip ${c.mode === m ? "active" : ""}`}
                                onClick={() => setCalc(i, (x) => ({ ...x, mode: m }))}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          {c.mode === "custom" && (
                            <>
                              {/* 더하기 */}
                              <div className="op-row">
                                <label className="op-on">
                                  <input
                                    type="checkbox"
                                    checked={c.add.on}
                                    onChange={(e) =>
                                      setCalc(i, (x) => ({ ...x, add: { ...x.add, on: e.target.checked } }))
                                    }
                                  />
                                  <b>＋ 더하기</b>
                                </label>
                                {c.add.on && (
                                  <div className="op-opts">
                                    <label className="op-field">
                                      자리수
                                      <select
                                        className="input"
                                        value={c.add.digits}
                                        onChange={(e) =>
                                          setCalc(i, (x) => ({
                                            ...x,
                                            add: { ...x.add, digits: Number(e.target.value) },
                                          }))
                                        }
                                      >
                                        {[1, 2, 3, 4].map((d) => (
                                          <option key={d} value={d}>
                                            {d}자리
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="op-check">
                                      <input
                                        type="checkbox"
                                        checked={c.add.carry}
                                        onChange={(e) =>
                                          setCalc(i, (x) => ({
                                            ...x,
                                            add: { ...x.add, carry: e.target.checked },
                                          }))
                                        }
                                      />
                                      올림 있는 문제
                                    </label>
                                  </div>
                                )}
                              </div>

                              {/* 빼기 */}
                              <div className="op-row">
                                <label className="op-on">
                                  <input
                                    type="checkbox"
                                    checked={c.sub.on}
                                    onChange={(e) =>
                                      setCalc(i, (x) => ({ ...x, sub: { ...x.sub, on: e.target.checked } }))
                                    }
                                  />
                                  <b>－ 빼기</b>
                                </label>
                                {c.sub.on && (
                                  <div className="op-opts">
                                    <label className="op-field">
                                      자리수
                                      <select
                                        className="input"
                                        value={c.sub.digits}
                                        onChange={(e) =>
                                          setCalc(i, (x) => ({
                                            ...x,
                                            sub: { ...x.sub, digits: Number(e.target.value) },
                                          }))
                                        }
                                      >
                                        {[1, 2, 3, 4].map((d) => (
                                          <option key={d} value={d}>
                                            {d}자리
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    {c.sub.digits > 1 ? (
                                      <label className="op-check">
                                        <input
                                          type="checkbox"
                                          checked={c.sub.borrow}
                                          onChange={(e) =>
                                            setCalc(i, (x) => ({
                                              ...x,
                                              sub: { ...x.sub, borrow: e.target.checked },
                                            }))
                                          }
                                        />
                                        빌려주기(내림) 있는 문제
                                      </label>
                                    ) : (
                                      <span className="muted" style={{ fontSize: 12 }}>
                                        한 자리 빼기엔 빌려주기가 없어요
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 곱하기 */}
                              <div className="op-row">
                                <label className="op-on">
                                  <input
                                    type="checkbox"
                                    checked={c.mul.on}
                                    onChange={(e) =>
                                      setCalc(i, (x) => ({ ...x, mul: { ...x.mul, on: e.target.checked } }))
                                    }
                                  />
                                  <b>× 곱하기</b>
                                </label>
                                {c.mul.on && (
                                  <div className="op-opts" style={{ flexDirection: "column", alignItems: "stretch" }}>
                                    <span className="muted" style={{ fontSize: 12 }}>
                                      문제에 나올 단을 고르세요
                                    </span>
                                    <div className="table-pick">
                                      {MUL_TABLES.map((t) => {
                                        const on = c.mul.tables.includes(t);
                                        return (
                                          <button
                                            key={t}
                                            type="button"
                                            className={on ? "on" : ""}
                                            onClick={() =>
                                              setCalc(i, (x) => ({
                                                ...x,
                                                mul: {
                                                  ...x.mul,
                                                  tables: on
                                                    ? x.mul.tables.filter((v) => v !== t)
                                                    : [...x.mul.tables, t].sort((a, b) => a - b),
                                                },
                                              }))
                                            }
                                          >
                                            {t}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {c.mul.tables.length === 0 && (
                                      <span style={{ fontSize: 12, color: "var(--bad)", fontWeight: 700 }}>
                                        단을 하나도 안 고르면 2~9단이 기본으로 나갑니다
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 나누기 */}
                              <div className="op-row">
                                <label className="op-on">
                                  <input
                                    type="checkbox"
                                    checked={c.div.on}
                                    onChange={(e) =>
                                      setCalc(i, (x) => ({ ...x, div: { ...x.div, on: e.target.checked } }))
                                    }
                                  />
                                  <b>÷ 나누기</b>
                                </label>
                                {c.div.on && (
                                  <div className="op-opts" style={{ flexDirection: "column", alignItems: "stretch" }}>
                                    <label className="op-check">
                                      <input
                                        type="checkbox"
                                        checked={c.div.remainder}
                                        onChange={(e) =>
                                          setCalc(i, (x) => ({
                                            ...x,
                                            div: { ...x.div, remainder: e.target.checked },
                                          }))
                                        }
                                      />
                                      나머지가 있는 나눗셈 포함
                                    </label>
                                    <span className="muted" style={{ fontSize: 12 }}>
                                      {c.div.remainder
                                        ? "몫과 나머지를 따로 물어봅니다 (한 칸에 같이 쓰지 않아요)"
                                        : "딱 나누어떨어지는 문제만 나옵니다"}
                                      {c.mul.on && c.mul.tables.length > 0 && ` · 나누는 수는 위에서 고른 단을 씁니다`}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <label className="op-check" style={{ borderTop: "1px dashed var(--line)", paddingTop: 10 }}>
                                <input
                                  type="checkbox"
                                  checked={c.includeWord}
                                  onChange={(e) =>
                                    setCalc(i, (x) => ({ ...x, includeWord: e.target.checked }))
                                  }
                                />
                                문장제(이야기 문제)도 조금 섞기
                              </label>
                            </>
                          )}
                        </div>
                      );
                    })()}
                </div>
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

          {/* 아이 전용 접속 링크 — 아이는 로그인 없이 이 링크로 들어온다 */}
          {data.googleEnabled && data.kids.length > 0 && (
            <div className="card stack">
              <div className="section-title">아이 전용 접속 링크</div>
              <p className="muted" style={{ fontSize: 12.5, wordBreak: "keep-all" }}>
                아이는 로그인하지 않습니다. 아래 링크를 아이 기기에서 한 번 열고 <b>홈 화면에 추가</b>해
                주세요. 이 링크로 들어온 아이는 자기 숙제만 풀 수 있고, 부모님 페이지와 형제의 기록은
                볼 수 없습니다.
              </p>
              {data.kids.map((k) => {
                const url = k.accessToken ? `${origin}/k/${k.accessToken}` : null;
                return (
                  <div key={k.id} className="kid-link-row">
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{k.emoji}</span>
                      <b style={{ fontSize: 14.5 }}>{k.name}</b>
                    </div>
                    {url ? (
                      <>
                        <div className="kid-link-url">{url}</div>
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          <button className="mini-btn" onClick={() => copyLink(url, k.id)}>
                            링크 복사
                          </button>
                          <button className="mini-btn" onClick={() => kidLink(k.id, "issue")}>
                            새 링크로 바꾸기
                          </button>
                          <button className="mini-btn danger" onClick={() => kidLink(k.id, "revoke")}>
                            링크 없애기
                          </button>
                        </div>
                      </>
                    ) : (
                      <button className="mini-btn" onClick={() => kidLink(k.id, "issue")}>
                        링크 만들기
                      </button>
                    )}
                    {linkMsg[k.id] && <span className="mini-msg">{linkMsg[k.id]}</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="card">
            <div className="section-title" style={{ marginBottom: 8 }}>
              문제은행 보유량
            </div>
            {/* 학년이 9개라 좁은 화면에서는 표가 넘친다 — 표만 가로로 넘겨 볼 수 있게 한다 */}
            <div className="table-scroll">
              <table className="bank-table">
                <thead>
                  <tr>
                    <th>과목</th>
                    {ALL_GRADES.map((g) => (
                      <th key={g}>{gradeShort(g)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUBJECTS.map((s) => (
                    <tr key={s}>
                      <td>
                        {SUBJECT_EMOJI[s]} {SUBJECT_LABEL[s]}
                      </td>
                      {ALL_GRADES.map((g) => {
                        const n = data.bank[s]?.[g] ?? 0;
                        // 수학은 자동 생성이 주력이라 0이어도 문제가 없다.
                        // 숫자 0을 그대로 두면 "문제가 없다"로 오해하므로 다르게 보여준다.
                        return (
                          <td key={g} className={n === 0 ? "muted" : undefined}>
                            {n === 0 ? "자동" : n}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
              수학은 <b>＋－×÷ 연산</b>과 <b>문장제</b> 모두 그때그때 자동으로 만들어져 마르지 않습니다
              (학년당 수천 가지). 표의 수학 숫자는 손으로 쓴 문장제만 센 것이라,{" "}
              <b>&quot;자동&quot;으로 표시돼도 문제가 부족한 것이 아닙니다.</b> 국어·영어가 부족해지면
              Claude Code에게 &quot;문제은행 리필해줘&quot;라고 요청하세요.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
