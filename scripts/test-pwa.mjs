/**
 * 공유 미리보기(OG)와 앱 설치(PWA) 검증.
 *
 * 이 둘은 망가져도 화면에 아무 표시가 없어서, 링크를 실제로 보내보거나
 * 홈 화면에 추가해 보기 전까지 모른다. 그래서 검사로 붙잡아 둔다.
 *
 * 특히 중요한 두 가지:
 *  - 로그인을 켜도 매니페스트·아이콘·OG 이미지는 열려 있어야 한다
 *    (막히면 앱 설치가 안 되고, 카카오톡 미리보기도 안 뜬다)
 *  - 서비스 워커가 화면(HTML)과 API를 캐시하면 안 된다
 *    (어제 숙제가 그대로 보이는 사고가 난다)
 *
 * 사전 준비: npm run build
 * 실행: node scripts/test-pwa.mjs
 */
import { spawn } from "child_process";
import { createServer as netServer } from "net";
import { readFileSync } from "fs";
import http from "http";

/**
 * Host 헤더를 바꿔서 요청한다.
 * fetch()는 Host를 "금지된 헤더"로 보고 조용히 빼버려서, 배포 주소를 흉내 낼 수 없다.
 */
function getWithHost(port, path, host) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path, method: "GET", headers: { Host: host } },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

function freePort() {
  return new Promise((resolve, reject) => {
    const s = netServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** PNG 헤더에서 실제 크기를 읽는다 (선언만 맞고 파일은 다른 경우를 잡기 위해) */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/* ─────────── 1) 서비스 워커가 위험한 캐시를 하지 않는지 (소스 검사) ─────────── */
console.log("=== 서비스 워커 안전성 ===");
const sw = readFileSync("public/sw.js", "utf8");
check("화면 이동(navigate)은 캐시하지 않음", /req\.mode\s*===\s*["']navigate["']/.test(sw) && /return;/.test(sw));
check("API 응답은 캐시하지 않음", /pathname\.startsWith\(["']\/api\//.test(sw));
check("캐시 대상은 정적 파일로 한정", /_next\/static/.test(sw) && /isCacheable/.test(sw));

/* ─────────── 2) 실제 서버로 확인 ─────────── */
const PORT = await freePort();
const BASE = `http://localhost:${PORT}`;
const HOST = "lovekids-indol.vercel.app";

// 구글 로그인을 켠 상태로 띄운다 (가장 엄격한 조건)
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  env: {
    ...process.env,
    GOOGLE_CLIENT_ID: "x",
    GOOGLE_CLIENT_SECRET: "y",
    SESSION_SECRET: "abcdefghij0123456789abcdefghij01",
    APP_URL: "",
    VERCEL_PROJECT_PRODUCTION_URL: "",
  },
  stdio: "ignore",
});

try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${BASE}/login`);
      if (r.ok) { ready = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  if (!ready) throw new Error("서버가 뜨지 않았습니다 (npm run build 먼저 실행했나요?)");

  console.log("\n=== 로그인을 켜도 열려 있어야 하는 파일 ===");
  const ASSETS = [
    ["/manifest.webmanifest", "application/manifest+json"],
    ["/sw.js", "javascript"],
    ["/og.png", "image/png"],
    ["/apple-touch-icon.png", "image/png"],
    ["/icons/icon-192.png", "image/png"],
    ["/icons/icon-512.png", "image/png"],
    ["/icons/icon-maskable-512.png", "image/png"],
  ];
  for (const [path, ctPart] of ASSETS) {
    const r = await fetch(`${BASE}${path}`);
    const ct = r.headers.get("content-type") ?? "";
    check(`${path} 접근 가능`, r.status === 200 && ct.includes(ctPart), `HTTP ${r.status} ${ct}`);
  }

  console.log("\n=== 앱·데이터는 여전히 보호 ===");
  for (const p of ["/", "/parent"]) {
    const r = await fetch(`${BASE}${p}`, { redirect: "manual" });
    check(`${p} 는 로그인으로 보냄`, r.status === 307, `HTTP ${r.status}`);
  }
  const api = await fetch(`${BASE}/api/state`);
  check("/api/state 는 401", api.status === 401, `HTTP ${api.status}`);

  console.log("\n=== 아이콘 파일이 실제로 그 크기인지 ===");
  const SIZES = [
    ["/icons/icon-192.png", 192],
    ["/icons/icon-512.png", 512],
    ["/icons/icon-maskable-512.png", 512],
    ["/apple-touch-icon.png", 180],
  ];
  for (const [path, want] of SIZES) {
    const buf = Buffer.from(await (await fetch(`${BASE}${path}`)).arrayBuffer());
    const s = pngSize(buf);
    check(`${path} = ${want}x${want}`, s?.w === want && s?.h === want, s ? `${s.w}x${s.h}` : "PNG 아님");
  }
  const og = Buffer.from(await (await fetch(`${BASE}/og.png`)).arrayBuffer());
  const ogs = pngSize(og);
  check("og.png = 1200x630 (공유 카드 표준 비율)", ogs?.w === 1200 && ogs?.h === 630, ogs ? `${ogs.w}x${ogs.h}` : "PNG 아님");

  console.log("\n=== 매니페스트 내용 ===");
  const m = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
  check("이름·짧은이름 있음", !!m.name && !!m.short_name, `${m.name} / ${m.short_name}`);
  check("standalone 모드 (주소창 없이 앱처럼)", m.display === "standalone", m.display);
  check("시작 주소 지정", m.start_url === "/", m.start_url);
  check("192·512 아이콘 모두 있음",
    m.icons?.some((i) => i.sizes === "192x192") && m.icons?.some((i) => i.sizes === "512x512"), "");
  check("maskable 아이콘 있음 (안드로이드 잘림 대비)",
    m.icons?.some((i) => i.purpose === "maskable"), "");

  console.log("\n=== 크롤러가 읽는 메타 태그 (카카오톡 미리보기) ===");
  // 로그인 없이 접속하면 /login 으로 가는데, 크롤러도 그 화면을 읽게 된다.
  // 배포 주소로 접속한 상황을 흉내 내려면 Host 헤더를 직접 지정해야 한다.
  const html = (await getWithHost(PORT, "/login", HOST)).body;
  const meta = (prop) =>
    html.match(new RegExp(`<meta[^>]*(?:property|name)="${prop}"[^>]*content="([^"]*)"`))?.[1] ??
    html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*(?:property|name)="${prop}"`))?.[1];

  check("og:title 있음", !!meta("og:title"), meta("og:title"));
  check("og:description 있음", !!meta("og:description"), (meta("og:description") ?? "").slice(0, 40) + "…");
  const img = meta("og:image");
  check("og:image 가 절대 주소", !!img && /^https?:\/\//.test(img), img);
  check(
    "og:image 가 localhost 가 아님 (실제 접속 주소를 따라감)",
    !!img && !img.includes("localhost"),
    img,
  );
  check("og:image 크기 정보 있음", meta("og:image:width") === "1200" && meta("og:image:height") === "630", "");
  check("twitter 카드 큰 이미지", meta("twitter:card") === "summary_large_image", meta("twitter:card"));
  // 최신 iOS는 표준 태그를, 16.4 이전 기기는 apple- 접두사 태그를 본다. 둘 다 있어야 안전하다.
  check("앱 모드: 표준 태그", /name="mobile-web-app-capable"[^>]*content="yes"/.test(html), "");
  check("앱 모드: 구형 iOS용 태그", /name="apple-mobile-web-app-capable"[^>]*content="yes"/.test(html), "");
  check("매니페스트 연결됨", /<link[^>]*rel="manifest"/.test(html), "");
  check("애플 아이콘 연결됨", /<link[^>]*rel="apple-touch-icon"/.test(html), "");

  // 검색 노출 차단 (가족용 사이트)
  check("검색엔진 색인 차단", /noindex/.test(html), "");
} catch (e) {
  console.error("✗ " + e.message);
  failed++;
} finally {
  server.kill();
}

console.log(failed === 0 ? "\n✅ OG·PWA 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
