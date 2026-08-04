/**
 * 저장소 자동 감지 검증.
 * Vercel + Upstash 조합에서 환경변수 이름이 상황에 따라 다르게 들어오는데,
 * 어떤 이름이 오더라도 앱이 저장소를 찾아내는지 확인한다.
 * 가짜 Redis REST 서버를 띄워 실제로 읽기/쓰기까지 확인한다.
 *
 * 사전 준비: npm run build
 * 실행: node scripts/test-storage.mjs
 */
import { spawn } from "child_process";
import { createServer } from "http";
import { createServer as netServer } from "net";

/** OS에게 비어 있는 포트를 받아온다 (순번으로 쓰면 앞 서버가 물고 있어 충돌한다) */
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

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

// --- 가짜 Upstash REST 서버 (GET /get/<key>, POST /set/<key>) ---
const store = new Map();
let sawAuth = null;
const fake = createServer((req, res) => {
  sawAuth = req.headers.authorization ?? null;
  const [, action, rawKey] = req.url.split("/");
  const key = decodeURIComponent(rawKey ?? "");
  if (action === "get") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ result: store.has(key) ? store.get(key) : null }));
  } else if (action === "set") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      store.set(key, body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: "OK" }));
    });
  } else {
    res.writeHead(404).end();
  }
});
await new Promise((r) => fake.listen(0, r));
const FAKE_URL = `http://127.0.0.1:${fake.address().port}`;

// --- Upstash가 넣어줄 수 있는 환경변수 이름들 ---
const NAMINGS = [
  { label: "KV_REST_API_* (Vercel KV 호환)", url: "KV_REST_API_URL", token: "KV_REST_API_TOKEN" },
  { label: "UPSTASH_REDIS_REST_* (Upstash 기본)", url: "UPSTASH_REDIS_REST_URL", token: "UPSTASH_REDIS_REST_TOKEN" },
  { label: "접두사 붙은 변형 (STORAGE_KV_...)", url: "STORAGE_KV_REST_API_URL", token: "STORAGE_KV_REST_API_TOKEN" },
  { label: "저장소 이름 접두사 (LOVEKIDS_UPSTASH_...)", url: "LOVEKIDS_UPSTASH_REDIS_REST_URL", token: "LOVEKIDS_UPSTASH_REDIS_REST_TOKEN" },
];

async function run(envExtra, label, expectKv) {
  const p = await freePort();
  const srv = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(p)], {
    env: { ...process.env, VERCEL: "1", FAMILY_CODE: "", ...envExtra },
    stdio: "ignore",
  });
  try {
    const base = `http://localhost:${p}`;
    let ready = false;
    let lastErr = "";
    for (let i = 0; i < 90; i++) {
      try {
        const r = await fetch(`${base}/api/state`);
        if (r.ok) { ready = true; break; }
        lastErr = `HTTP ${r.status}`;
      } catch (e) {
        lastErr = e.cause?.code ?? e.message;
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    if (!ready) console.log(`   (마지막 응답: ${lastErr})`);
    if (!ready) return check(label, false, "서버가 뜨지 않음");

    const d = await (await fetch(`${base}/api/parent/data`, { headers: { "x-pin": "0000" } })).json();
    check(label, d.storage === (expectKv ? "kv" : "memory"), `storage=${d.storage}${d.storageVia ? ` (via ${d.storageVia})` : ""}`);

    if (expectKv) {
      // 실제로 저장·조회가 되는지 왕복 확인
      store.clear();
      const saved = await fetch(`${base}/api/parent/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "0000", kids: [{ name: "저장확인", grade: 3, emoji: "🐻", perDay: { ko: 1, en: 0, math: 1 } }] }),
      });
      check(`  └ 저장 요청 성공`, saved.ok, `HTTP ${saved.status}`);
      check(`  └ Redis에 실제로 기록됨`, store.has("settings"), `키 ${[...store.keys()].join(",") || "없음"}`);
      check(`  └ 토큰이 Authorization 헤더로 전달됨`, (sawAuth ?? "").startsWith("Bearer "), sawAuth ? "있음" : "없음");
      const back = await (await fetch(`${base}/api/state`)).json();
      check(`  └ 다시 읽어도 아이가 남아 있음`, back.kids?.[0]?.name === "저장확인", JSON.stringify(back.kids?.map((k) => k.name)));
    } else {
      check(`  └ 진단에 환경변수 이름이 보고됨`, Array.isArray(d.storageEnv), `${(d.storageEnv ?? []).length}개`);
    }
  } finally {
    srv.kill();
    await new Promise((r) => setTimeout(r, 800));
  }
}

console.log("=== 환경변수 이름별 자동 감지 ===");
for (const n of NAMINGS) {
  await run({ [n.url]: FAKE_URL, [n.token]: "fake-token-123" }, n.label, true);
}

console.log("\n=== 저장소가 없을 때 (경고가 떠야 함) ===");
await run({}, "환경변수 없음 → memory 판정", false);

console.log("\n=== 토큰 없이 URL만 있을 때 (짝이 안 맞음 → 연결 안 함) ===");
await run({ KV_REST_API_URL: FAKE_URL }, "URL만 있고 토큰 없음 → memory 판정", false);

fake.close();
console.log(failed === 0 ? "\n✅ 저장소 감지 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
