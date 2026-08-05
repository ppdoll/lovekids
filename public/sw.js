/*
 * 러브키즈 숙제방 서비스 워커
 *
 * 목적은 두 가지뿐이다.
 *   1) 홈 화면에 "앱으로 설치"가 가능하게 한다 (안드로이드 크롬이 서비스 워커를 요구한다)
 *   2) 아이콘·정적 파일만 캐시해 두 번째 방문부터 빠르게 뜨게 한다
 *
 * 절대 하지 않는 것: 화면(HTML)과 API 응답 캐시.
 * 숙제는 매일 바뀌고 채점 결과가 즉시 반영돼야 하는데, 이걸 캐시하면
 * "어제 문제가 그대로 보인다", "다 풀었는데 안 풀린 걸로 나온다" 같은 사고가 난다.
 */

const VERSION = "v1";
const CACHE = `lovekids-static-${VERSION}`;

self.addEventListener("install", (event) => {
  // 새 버전을 바로 적용한다 (오래된 워커가 남아 낡은 파일을 주지 않도록)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(["/icons/icon-192.png", "/icons/icon-512.png", "/apple-touch-icon.png"]).catch(() => {}),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/** 캐시해도 안전한 것: 내용이 바뀌면 주소도 바뀌는 빌드 산출물과, 거의 변하지 않는 아이콘 */
function isCacheable(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  return url.pathname === "/apple-touch-icon.png" || url.pathname === "/icon.svg";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 화면 이동과 API는 항상 네트워크에서 새로 받아온다
  if (req.mode === "navigate" || url.pathname.startsWith("/api/")) return;

  if (!isCacheable(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      // 캐시가 있으면 바로 주고, 뒤에서 조용히 새 파일을 받아 둔다
      const fetching = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return hit || (await fetching) || fetch(req);
    })(),
  );
});
