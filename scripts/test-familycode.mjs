/**
 * 가족 코드 잠금 검증 (한글 코드 포함).
 * 운영 빌드(next start)를 직접 띄워서 다음을 확인한다:
 *   - 코드 없이 페이지 접속 → /enter 로 보냄
 *   - 코드 없이 API 접속 → 401
 *   - 틀린 코드 → 403
 *   - 맞는 코드 → 쿠키 발급 후 정상 접속
 *   - 조합 방식이 다른 한글(NFD)로 입력해도 통과 (폰/맥에서 입력한 경우)
 *
 * 사전 준비: npm run build
 * 실행: node scripts/test-familycode.mjs
 */
import { spawn } from "child_process";

const CODE = "우리집2026"; // 한글 + 숫자
const PORT = 3123;
const BASE = `http://localhost:${PORT}`;

// .cmd 래퍼는 윈도우에서 spawn이 거부하므로 next 실행 파일을 node로 직접 띄운다
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  { env: { ...process.env, FAMILY_CODE: CODE }, stdio: "ignore" },
);

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/enter`, { redirect: "manual" });
      if (r.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

try {
  if (!(await waitReady())) throw new Error("서버가 뜨지 않았습니다 (npm run build 먼저 실행했나요?)");

  let r = await fetch(`${BASE}/`, { redirect: "manual" });
  check("코드 없이 홈 → /enter 로 보냄", r.status === 307 && (r.headers.get("location") ?? "").endsWith("/enter"), `HTTP ${r.status}`);

  r = await fetch(`${BASE}/api/state`);
  check("코드 없이 API → 401", r.status === 401, `HTTP ${r.status}`);

  r = await fetch(`${BASE}/enter`);
  check("/enter 페이지는 열림", r.status === 200, `HTTP ${r.status}`);

  r = await fetch(`${BASE}/api/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "다른코드9999" }),
  });
  check("틀린 코드 → 403", r.status === 403, `HTTP ${r.status}`);

  // 맞는 코드 (한글, NFC)
  r = await fetch(`${BASE}/api/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: CODE }),
  });
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  check("맞는 한글 코드 → 200 + 쿠키 발급", r.status === 200 && cookie.startsWith("family_code="), `HTTP ${r.status}`);

  r = await fetch(`${BASE}/api/state`, { headers: { cookie } });
  check("쿠키로 API 정상 접속", r.status === 200, `HTTP ${r.status}`);

  r = await fetch(`${BASE}/`, { headers: { cookie }, redirect: "manual" });
  check("쿠키로 홈 정상 접속", r.status === 200, `HTTP ${r.status}`);

  // 폰/맥에서 입력하면 같은 글자가 자모 분리(NFD)로 올 수 있다 — 그래도 통과해야 한다
  const nfd = CODE.normalize("NFD");
  check("NFD가 NFC와 바이트가 다름(테스트 자체가 유효한지 확인)", nfd !== CODE);
  r = await fetch(`${BASE}/api/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: nfd }),
  });
  check("조합 방식 다른 한글(NFD)도 통과", r.status === 200, `HTTP ${r.status}`);

  // 앞뒤 공백이 섞여도 통과
  r = await fetch(`${BASE}/api/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: `  ${CODE} ` }),
  });
  check("앞뒤 공백 섞여도 통과", r.status === 200, `HTTP ${r.status}`);
} catch (e) {
  console.error("✗ " + e.message);
  failed++;
} finally {
  server.kill();
}

console.log(failed === 0 ? "\n✅ 가족 코드 잠금 검사 통과" : `\n❌ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
