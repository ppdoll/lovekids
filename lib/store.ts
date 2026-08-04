import { promises as fs } from "fs";
import path from "path";

/**
 * 저장소 추상화.
 * - 배포(Vercel): Upstash Redis REST (KV_REST_API_URL/TOKEN 또는 UPSTASH_REDIS_REST_URL/TOKEN)
 * - 로컬 개발: .data/store.json 파일
 * - 그 외(배포됐지만 KV 미설정): 메모리 (경고 — 서버 재시작 시 초기화됨)
 */

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const DATA_FILE = path.join(process.cwd(), ".data", "store.json");
const memory = new Map<string, string>();
let fileWritable: boolean | null = null;

export function storageMode(): "kv" | "file" | "memory" {
  if (REST_URL && REST_TOKEN) return "kv";
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
  if (REST_URL && REST_TOKEN) {
    const res = await fetch(`${REST_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REST_TOKEN}` },
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
  if (REST_URL && REST_TOKEN) {
    await fetch(`${REST_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REST_TOKEN}` },
      body: str,
    });
    return;
  }
  const store = await readFileStore();
  store[key] = str;
  const ok = await writeFileStore(store);
  if (!ok) memory.set(key, str);
}
