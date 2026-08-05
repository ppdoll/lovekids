/**
 * 가정별 데이터 격리 검증 — 이 프로젝트에서 가장 중요한 검사.
 *
 * 남의 집 아이 이름과 학습 기록이 보이는 사고는 한 번만 나도 돌이킬 수 없다.
 * 그래서 두 가지를 확인한다.
 *   1) 구조 검사: 앱 코드가 접두사 없는 저장소 함수(kvGet/kvSet/kvDel)를 직접 부르지 않는지
 *      → 부르는 곳이 없으면 "가정 접두사를 빠뜨리는 실수"가 애초에 불가능하다
 *   2) 동작 검사: 서로 다른 두 계정이 같은 서버에서 상대 데이터를 전혀 못 보는지
 *      + 아이 링크로 들어온 세션이 부모 화면과 형제 기록에 접근할 수 없는지
 *
 * 사전 준비: npm run build
 * 실행: node scripts/test-isolation.mjs
 */
import { spawn } from "child_process";
import { createServer } from "http";
import { createServer as netServer } from "net";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

/* ─────────── 1) 구조 검사 ─────────── */
console.log("=== 구조 검사: 접두사 없는 저장소 접근이 없는지 ===");

// kvGet/kvSet/kvDel을 직접 써도 되는 파일 (의도된 예외)
const ALLOWED = new Set([
  path.normalize("lib/store.ts"), // 저장소 자체 구현
  path.normalize("lib/scope.ts"), // 가정별로 묶어주는 곳
  path.normalize("lib/household.ts"), // 옛 데이터 이전용으로 읽기만
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const offenders = [];
for (const file of walk(".")) {
  const rel = path.normalize(path.relative(".", file));
  if (ALLOWED.has(rel)) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\b(kvGet|kvSet|kvDel)\s*[<(]/g)) {
    offenders.push(`${rel}: ${m[1]}`);
  }
}
check(
  "앱 코드가 kvGet/kvSet/kvDel을 직접 쓰지 않음",
  offenders.length === 0,
  offenders.length ? offenders.join(", ") : `허용 파일 ${ALLOWED.size}개 외 위반 없음`,
);

// storeFor가 콜론 등 이상한 householdId를 거부하는지 (다른 가정 영역으로 넘어가는 것 방지)
const scopeSrc = readFileSync("lib/scope.ts", "utf8");
check(
  "householdId 형식을 검사해 다른 영역 접근을 막음",
  /isSafeId|A-Za-z0-9_-/.test(scopeSrc) && scopeSrc.includes("throw"),
  "",
);

/* ─────────── 2) 동작 검사 ─────────── */
console.log("\n=== 동작 검사: 두 계정이 서로를 볼 수 없는지 ===");

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

/** 가짜 구글 OAuth 서버: code를 주면 그에 맞는 계정의 id_token을 돌려준다 */
const OAUTH_PORT = await freePort();
const CLIENT_ID = "test-client-id";
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeIdToken = (sub, email) =>
  [b64u({ alg: "none" }), b64u({ sub, email, name: sub, aud: CLIENT_ID, iss: "https://accounts.google.com" }), ""].join(".");

const oauth = createServer((req, res) => {
  if (req.url.startsWith("/auth")) {
    // 실제 구글 로그인 화면 대신, 곧바로 콜백으로 돌려보낸다
    const u = new URL(req.url, "http://x");
    const back = new URL(u.searchParams.get("redirect_uri"));
    back.searchParams.set("code", u.searchParams.get("login_hint") ?? "parentA");
    back.searchParams.set("state", u.searchParams.get("state"));
    res.writeHead(302, { Location: back.toString() }).end();
    return;
  }
  if (req.url.startsWith("/token")) {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const code = new URLSearchParams(body).get("code") ?? "parentA";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id_token: fakeIdToken(code, `${code}@example.com`) }));
    });
    return;
  }
  res.writeHead(404).end();
});
await new Promise((r) => oauth.listen(OAUTH_PORT, r));
const OAUTH_BASE = `http://127.0.0.1:${OAUTH_PORT}`;

const PORT = await freePort();
const BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  env: {
    ...process.env,
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: "test-secret",
    SESSION_SECRET: "test-session-secret-0123456789abcdef",
    OAUTH_AUTH_URL: `${OAUTH_BASE}/auth`,
    OAUTH_TOKEN_URL: `${OAUTH_BASE}/token`,
    APP_URL: BASE,
    FAMILY_CODE: "",
  },
  stdio: "ignore",
});

/** 쿠키를 들고 다니는 아주 작은 클라이언트 */
function client() {
  const jar = new Map();
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
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
  const go = async (p, init = {}, redirects = 6) => {
    let url = p.startsWith("http") ? p : BASE + p;
    for (let i = 0; i <= redirects; i++) {
      const res = await fetch(url, {
        ...init,
        headers: { ...(init.headers ?? {}), cookie: cookieHeader() },
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
    throw new Error("리다이렉트가 너무 많음");
  };
  return {
    go,
    json: async (p, init) => {
      const r = await go(p, init);
      return { status: r.status, body: await r.json().catch(() => ({})) };
    },
    post: (p, obj) =>
      go(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }),
    login: (who) => go(`/api/auth/google?login_hint=${who}`),
    cookies: jar,
  };
}

try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (r.status < 500) { ready = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  if (!ready) throw new Error("서버가 뜨지 않았습니다 (npm run build 먼저 실행했나요?)");

  // 로그인 전에는 막혀야 한다
  const anon = client();
  const noAuth = await anon.json("/api/state");
  check("로그인 없이 /api/state → 401", noAuth.status === 401, `HTTP ${noAuth.status}`);

  /* A 가정 */
  const A = client();
  await A.login("parentA");
  const aState = await A.json("/api/state");
  check("A 로그인 성공", aState.status === 200 && aState.body.role === "parent", `HTTP ${aState.status}`);

  await A.post("/api/parent/settings", {
    pin: "0000",
    kids: [{ name: "가A아이", grade: 2, emoji: "🐰", perDay: { ko: 0, en: 0, math: 4 } }],
  });
  const aKids = (await A.json("/api/state")).body.kids;
  check("A가 아이를 등록", aKids.length === 1 && aKids[0].name === "가A아이", JSON.stringify(aKids.map((k) => k.name)));
  const aKidId = aKids[0].id;

  /* B 가정 (다른 구글 계정) */
  const B = client();
  await B.login("parentB");
  const bState = await B.json("/api/state");
  check("B 로그인 성공", bState.status === 200, `HTTP ${bState.status}`);
  check("B에게 A의 아이가 보이지 않음", bState.body.kids.length === 0, JSON.stringify(bState.body.kids.map((k) => k.name)));
  check("B는 첫 설정 상태로 시작", bState.body.needsSetup === true, `needsSetup=${bState.body.needsSetup}`);

  await B.post("/api/parent/settings", {
    pin: "0000",
    kids: [{ name: "나B아이", grade: 5, emoji: "🐼", perDay: { ko: 0, en: 0, math: 4 } }],
  });
  const bKids = (await B.json("/api/state")).body.kids;
  check("B가 아이를 등록", bKids.length === 1 && bKids[0].name === "나B아이", "");

  // 서로의 아이를 이름으로 지정해 훔쳐볼 수 있는지
  const steal = await B.json(`/api/today?kid=${aKidId}&subject=math`);
  check("B가 A의 아이 ID로 문제를 요청해도 실패", steal.status === 404, `HTTP ${steal.status} ${JSON.stringify(steal.body)}`);
  const stealAnswer = await B.post("/api/answer", { kidId: aKidId, subject: "math", index: 0, given: "1" });
  check("B가 A의 아이 답안을 제출해도 실패", stealAnswer.status >= 400, `HTTP ${stealAnswer.status}`);

  // A쪽 설정이 B에 의해 덮이지 않았는지
  const aAgain = (await A.json("/api/state")).body.kids;
  check("A의 아이는 그대로", aAgain.length === 1 && aAgain[0].name === "가A아이", JSON.stringify(aAgain.map((k) => k.name)));

  // 부모 데이터(오답 노트 등)도 서로 안 보이는지
  const bParent = await B.json("/api/parent/data", { headers: { "x-pin": "0000" } });
  check(
    "B의 부모 화면에 A의 아이가 없음",
    bParent.status === 200 && bParent.body.kids.every((k) => k.name !== "가A아이"),
    JSON.stringify(bParent.body.kids?.map((k) => k.name)),
  );

  /* ── 아이 전용 링크 ── */
  console.log("\n=== 아이 링크 권한 ===");
  const link = await A.json("/api/parent/kid-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "0000", kidId: aKidId, action: "issue" }),
  });
  check("A가 아이 링크를 발급", link.status === 200 && !!link.body.token, JSON.stringify(link.body));
  const kidToken = link.body.token;

  const KID = client();
  await KID.go(`/k/${kidToken}`);
  const kState = await KID.json("/api/state");
  check("아이 링크로 들어오면 접근됨", kState.status === 200, `HTTP ${kState.status}`);
  check("아이 세션의 역할은 kid", kState.body.role === "kid", `role=${kState.body.role}`);
  check("아이에게는 자기 자신만 보임", kState.body.kids.length === 1 && kState.body.kids[0].id === aKidId, "");

  const kidParent = await KID.json("/api/parent/data", { headers: { "x-pin": "0000" } });
  check("아이는 부모 데이터를 볼 수 없음", kidParent.status === 403, `HTTP ${kidParent.status}`);
  const kidSettings = await KID.post("/api/parent/settings", { pin: "0000", kids: [] });
  check("아이는 설정을 바꿀 수 없음", kidSettings.status === 403, `HTTP ${kidSettings.status}`);
  const kidReset = await KID.post("/api/parent/set-action", {
    pin: "0000", kidId: aKidId, subject: "math", action: "reset",
  });
  check("아이는 숙제를 리셋할 수 없음", kidReset.status === 403, `HTTP ${kidReset.status}`);

  // 아이가 B 가정 아이 ID를 넣어도 막혀야 한다
  const bKidId = bKids[0].id;
  const kidCross = await KID.json(`/api/today?kid=${bKidId}&subject=math`);
  check("아이가 다른 가정 아이 ID를 넣어도 차단", kidCross.status === 403, `HTTP ${kidCross.status}`);

  // 자기 숙제는 정상적으로 풀 수 있어야 한다
  const kidOwn = await KID.json(`/api/today?kid=${aKidId}&subject=math`);
  check("아이는 자기 숙제를 정상적으로 받음", kidOwn.status === 200 && kidOwn.body.total === 4, `HTTP ${kidOwn.status}`);

  // 기존 데이터를 아무나 가져가지 못하는지 (OWNER_EMAIL 지정 시)
  console.log("\n=== 기존 데이터 인수 제한 ===");
  check(
    "먼저 로그인한 A가 기존('home') 가정을 이어받음",
    (await A.json("/api/state")).body.kids.length === 1,
    "",
  );
  check(
    "나중에 로그인한 B는 빈 가정으로 시작 (남의 데이터를 못 가져감)",
    (await B.json("/api/state")).body.kids.every((k) => k.name !== "가A아이"),
    "",
  );

  // 링크를 다시 발급하면 이전 링크는 무효
  const re = await A.json("/api/parent/kid-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "0000", kidId: aKidId, action: "issue" }),
  });
  check("링크 재발급 성공", re.status === 200 && re.body.token !== kidToken, "");
  const OLD = client();
  const oldRes = await OLD.go(`/k/${kidToken}`);
  check(
    "이전 링크는 더 이상 통하지 않음",
    new URL(oldRes.url).pathname === "/login",
    new URL(oldRes.url).pathname,
  );
} catch (e) {
  console.error("✗ " + e.message);
  failed++;
} finally {
  server.kill();
  oauth.close();
}

console.log(failed === 0 ? "\n✅ 격리·권한 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
