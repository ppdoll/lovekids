import { promises as fs } from "fs";
import path from "path";

/**
 * 저장소 추상화.
 * - 배포(Vercel): Upstash Redis REST (KV_REST_API_URL/TOKEN 또는 UPSTASH_REDIS_REST_URL/TOKEN)
 * - 로컬 개발: .data/store.json 파일
 * - 그 외(배포됐지만 KV 미설정): 메모리 (경고 — 서버 재시작 시 초기화됨)
 */

/**
 * Redis REST 접속 정보를 환경변수에서 찾는다.
 *
 * Vercel에서 Upstash를 연결하면 환경변수 이름이 상황에 따라 달라진다
 * (KV_REST_API_*, UPSTASH_REDIS_REST_*, 저장소 이름이 접두사로 붙은 변형 등).
 * 이름을 하나로 못 박아두면 "연결했는데 왜 안 되지" 하고 헤매게 되므로,
 * 표준 이름을 먼저 보고 없으면 형태가 맞는 변수를 찾아낸다.
 */
function findRedisRest(): { url: string; token: string; via: string } | null {
  const env = process.env;

  const known: [string, string][] = [
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    ["REDIS_REST_API_URL", "REDIS_REST_API_TOKEN"],
  ];
  for (const [u, t] of known) {
    if (env[u] && env[t]) return { url: env[u]!, token: env[t]!, via: u };
  }

  // 접두사가 붙은 변형 (예: STORAGE_KV_REST_API_URL)
  for (const key of Object.keys(env)) {
    if (!/(REST_API_URL|REDIS_REST_URL)$/.test(key)) continue;
    const url = env[key];
    if (!url || !/^https?:\/\//.test(url)) continue;
    const token = env[key.replace(/URL$/, "TOKEN")];
    if (token) return { url, token, via: key };
  }
  return null;
}

let restCache: { url: string; token: string; via: string } | null | undefined;
function rest() {
  if (restCache === undefined) restCache = findRedisRest();
  return restCache;
}

/**
 * 저장소 관련 환경변수 진단용 — **이름만** 돌려준다. 값(비밀 토큰)은 절대 내보내지 않는다.
 */
export function storageEnvNames(): string[] {
  return Object.keys(process.env)
    .filter((k) => /(^KV_|UPSTASH|REDIS)/.test(k))
    .sort();
}

/** 어떤 환경변수로 연결됐는지 (연결 안 됐으면 null) */
export function storageVia(): string | null {
  return rest()?.via ?? null;
}

const DATA_FILE = path.join(process.cwd(), ".data", "store.json");
const memory = new Map<string, string>();
let fileWritable: boolean | null = null;
let lastWriteError: string | null = null;

/** 마지막 저장 시도가 실패했다면 그 이유 (성공했거나 시도 전이면 null) */
export function storageWriteError(): string | null {
  return lastWriteError;
}

export function storageMode(): "kv" | "file" | "memory" {
  if (rest()) return "kv";
  // 서버리스(Vercel)에서는 파일에 써도 남지 않는다.
  // 첫 저장을 시도해 볼 때까지 기다리지 않고 바로 알려야, 설정이 사라지는 일을 겪지 않는다.
  if (process.env.VERCEL) return "memory";
  if (fileWritable === false) return "memory";
  return "file";
}

async function readFileStore(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeFileStore(obj: Record<string, string>): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 1), "utf8");
    fileWritable = true;
    return true;
  } catch {
    fileWritable = false;
    return false;
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const r = rest();
  if (r) {
    const res = await fetch(`${r.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${r.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result: string | null };
    if (json.result == null) return null;
    try {
      return JSON.parse(json.result) as T;
    } catch {
      return null;
    }
  }
  if (memory.has(key)) return JSON.parse(memory.get(key)!) as T;
  const store = await readFileStore();
  return key in store ? (JSON.parse(store[key]) as T) : null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const str = JSON.stringify(value);
  const r = rest();
  if (r) {
    // 저장 실패를 조용히 넘기면 기록이 사라진 걸 아무도 모른다. 실패는 남겨서 부모 화면에 알린다.
    try {
      const res = await fetch(`${r.url}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${r.token}` },
        body: str,
      });
      if (!res.ok) {
        lastWriteError = `Redis 저장 실패 (HTTP ${res.status})`;
        memory.set(key, str);
      } else {
        lastWriteError = null;
      }
    } catch {
      lastWriteError = "Redis 서버에 연결하지 못했습니다";
      memory.set(key, str);
    }
    return;
  }
  const store = await readFileStore();
  store[key] = str;
  const ok = await writeFileStore(store);
  if (!ok) memory.set(key, str);
}
