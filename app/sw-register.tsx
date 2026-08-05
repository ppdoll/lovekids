"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록.
 * 홈 화면에 앱으로 설치할 수 있게 하고, 아이콘 같은 정적 파일을 캐시한다.
 * (숙제 내용과 채점 결과는 캐시하지 않는다 — public/sw.js 참고)
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // 개발 중에는 등록하지 않는다. 코드를 고쳐도 낡은 파일이 남아 헷갈리기 쉽다.
    if (process.env.NODE_ENV !== "production") return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 설치가 안 돼도 사이트 사용에는 지장이 없다 */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
