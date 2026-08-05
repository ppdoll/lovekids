/**
 * "기존 데이터를 누가 이어받는가" 검증.
 *
 * 구글 로그인을 붙이기 전에 쌓인 데이터(아이 이름·학습 기록)는 원래 주인 것이다.
 * 그런데 "처음 로그인한 사람이 가져간다"로 두면, 주인이 로그인하기 전에 남이 먼저
 * 들어오는 순간 그 사람이 아이들 기록의 주인이 되어 버린다.
 * OWNER_EMAIL을 정해 두면 그 계정만 이어받는지 확인한다.
 *
 * 사전 준비: npm run build
 * 실행: node scripts/test-owner.mjs
 */
import { spawn } from "child_process";
import { createServer } from "http";
import { createServer as netServer } from "net";
import { mkdirSync, writeFileSync, rmSync } from "fs";

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

const CLIENT_ID = "test-client-id";
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeIdToken = (sub, email) =>
  [
    b64u({ alg: "none" }),
    b64u({ sub, email, name: sub, aud: CLIENT_ID, iss: "https://accounts.google.com" }),
    "",
  ].join(".");

const OAUTH_PORT = await freePort();
const oauth = createServer((req, res) => {
  if (req.url.startsWith("/auth")) {
    const u = new URL(req.url, "http://x");
    const back = new URL(u.searchParams.get("redirect_uri"));
    back.searchParams.set("code", u.searchParams.get("login_hint") ?? "someone");
    back.searchParams.set("state", u.searchParams.get("state"));
    res.writeHead(302, { Location: back.toString() }).end();
    return;
  }
  if (req.url.startsWith("/token")) {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const code = new URLSearchParams(body).get("code") ?? "someone";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id_token: fakeIdToken(code, `${code}@example.com`) }));
    });
    return;
  }
  res.writeHead(404).end();
});
await new Promise((r) => oauth.listen(OAUTH_PORT, r));
const OAUTH_BASE = `http://127.0.0.1:${OAUTH_PORT}`;

/** 구글 로그인을 붙이기 전 상태(접두사 없는 키)로 데이터를 깔아 둔다 */
function seedLegacyData() {
  rmSync(".data", { recursive: true, force: true });
  mkdirSync(".data", { recursive: true });
  writeFileSync(
    ".data/store.json",
    JSON.stringify({
      settings: JSON.stringify({
        kids: [{ id: "old1", name: "우리집아이", grade: 3, emoji: "🐰", perDay: { ko: 0, en: 0, math: 3 } }],
        parentPin: "0000",
      }),
      "history:old1": JSON.stringify({ "2026-08-01": { math: { done: true, correct: 3, total: 3 } } }),
    }),
  );
}

function client(BASE) {
  const jar = new Map();
  const absorb = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (v === "" || /Max-Age=0/i.test(c)) jar.delete(k);
      else jar.set(k, v);
    }
  };
  const go = async (p, init = {}, hops = 6) => {
    let url = p.startsWith("http") ? p : BASE + p;
    for (let i = 0; i <= hops; i++) {
      const res = await fetch(url, {
        ...init,
        headers: { ...(init.headers ?? {}), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
        redirect: "manual",
      });
      absorb(res);
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location"), url).toString();
        init = { method: "GET" };
        continue;
      }
      return res;
    }
    throw new Error("리다이렉트 과다");
  };
  return {
    login: (who) => go(`/api/auth/google?login_hint=${who}`),
    state: async () => (await (await go("/api/state")).json()),
  };
}

async function scenario(label, ownerEmail, firstLogin) {
  seedLegacyData();
  const PORT = await freePort();
  const BASE = `http://localhost:${PORT}`;
  const srv = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: "test-secret",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
      OAUTH_AUTH_URL: `${OAUTH_BASE}/auth`,
      OAUTH_TOKEN_URL: `${OAUTH_BASE}/token`,
      APP_URL: BASE,
      OWNER_EMAIL: ownerEmail,
    },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 90; i++) {
      try {
        const r = await fetch(`${BASE}/login`);
        if (r.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 700));
    }
    const c = client(BASE);
    await c.login(firstLogin);
    const kids = (await c.state()).kids ?? [];
    return kids.map((k) => k.name);
  } finally {
    srv.kill();
    await new Promise((r) => setTimeout(r, 600));
  }
}

console.log("=== OWNER_EMAIL을 정해 둔 경우 ===");
const stranger = await scenario("남이 먼저 로그인", "owner@example.com", "stranger");
check(
  "남이 먼저 로그인해도 기존 데이터를 못 가져감",
  !stranger.includes("우리집아이"),
  `보이는 아이: ${JSON.stringify(stranger)}`,
);

const owner = await scenario("주인이 로그인", "owner@example.com", "owner");
check(
  "주인 계정은 기존 데이터를 그대로 이어받음",
  owner.includes("우리집아이"),
  `보이는 아이: ${JSON.stringify(owner)}`,
);

console.log("\n=== OWNER_EMAIL을 안 정한 경우 (기존 동작 유지) ===");
const anyone = await scenario("아무나 먼저", "", "someone");
check(
  "처음 로그인한 계정이 이어받음 (설정 전 사용자를 위한 하위 호환)",
  anyone.includes("우리집아이"),
  `보이는 아이: ${JSON.stringify(anyone)}`,
);

oauth.close();
rmSync(".data", { recursive: true, force: true });
console.log(failed === 0 ? "\n✅ 데이터 인수 제한 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
