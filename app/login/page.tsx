"use client";

import { useEffect, useState } from "react";

const MESSAGES: Record<string, string> = {
  state: "로그인 요청이 만료됐어요. 다시 시도해 주세요.",
  exchange: "구글 로그인에 실패했어요. 다시 시도해 주세요.",
  "not-configured": "구글 로그인이 설정되지 않았어요.",
  "kid-link": "이 접속 링크는 더 이상 쓸 수 없어요. 부모님께 새 링크를 받아 주세요.",
};

export default function LoginPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const e = new URLSearchParams(location.search).get("error");
    if (e) setError(MESSAGES[e] ?? "로그인에 문제가 생겼어요. 다시 시도해 주세요.");
  }, []);

  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <h1 className="top-title">러브키즈 숙제방 💕</h1>
      <p className="top-sub">부모님 계정으로 로그인해 주세요</p>

      <div className="card stack center">
        <div style={{ fontSize: 46 }}>📚</div>
        <p className="muted" style={{ wordBreak: "keep-all" }}>
          아이는 로그인하지 않아요. 부모님이 로그인한 뒤 만들어 주는 <b>아이 전용 링크</b>로 바로
          들어옵니다.
        </p>

        {error && (
          <p style={{ color: "var(--bad)", fontSize: 14, fontWeight: 700, wordBreak: "keep-all" }}>
            {error}
          </p>
        )}

        <a href="/api/auth/google" className="btn btn-primary btn-block">
          <span style={{ fontSize: 18 }}>🔐</span> 구글로 로그인
        </a>
      </div>
    </main>
  );
}
