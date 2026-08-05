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
  const [help, setHelp] = useState(false);
  const [cfg, setCfg] = useState<{ redirectUri?: string; source?: string } | null>(null);

  useEffect(() => {
    const e = new URLSearchParams(location.search).get("error");
    if (e) setError(MESSAGES[e] ?? "로그인에 문제가 생겼어요. 다시 시도해 주세요.");
  }, []);

  useEffect(() => {
    if (help && !cfg) {
      fetch("/api/auth/config")
        .then((r) => r.json())
        .then(setCfg)
        .catch(() => setCfg({}));
    }
  }, [help, cfg]);

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

        <button className="badge" onClick={() => setHelp((v) => !v)}>
          구글 로그인이 안 되나요?
        </button>

        {help && (
          <div className="login-help">
            <p style={{ wordBreak: "keep-all" }}>
              <b>redirect_uri_mismatch</b> 오류가 나면, 구글 클라우드 콘솔의 <b>승인된 리디렉션 URI</b>에
              아래 주소가 <b>정확히</b> 등록되어 있어야 합니다.
            </p>
            <div className="login-help-url">{cfg?.redirectUri ?? "확인하는 중..."}</div>
            {cfg?.redirectUri && (
              <>
                <button
                  className="mini-btn"
                  onClick={() => navigator.clipboard?.writeText(cfg.redirectUri!)}
                >
                  주소 복사
                </button>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                  이 주소는 <b>{cfg.source}</b>에서 정했습니다. 배포 주소와 다르면 Vercel 환경변수{" "}
                  <code>APP_URL</code>에 실제 주소(예: https://내주소.vercel.app)를 넣고 재배포하세요.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
