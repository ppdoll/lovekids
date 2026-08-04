"use client";

import { useState } from "react";

export default function EnterPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      location.href = "/";
    } else {
      setError("코드가 맞지 않아요. 다시 확인해 주세요!");
    }
  }

  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <h1 className="top-title">러브키즈 숙제방 💕</h1>
      <p className="top-sub">우리 가족만 들어올 수 있어요</p>
      <form className="card stack" onSubmit={submit}>
        <div className="center" style={{ fontSize: 44 }}>
          🔑
        </div>
        <input
          className="short-input"
          style={{ textAlign: "center" }}
          placeholder="가족 코드를 입력하세요"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="center" style={{ color: "var(--bad)", fontSize: 14, fontWeight: 700 }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={busy}>
          들어가기
        </button>
      </form>
    </main>
  );
}
