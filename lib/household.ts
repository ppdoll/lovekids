import { globalStore, storeFor } from "./scope";
// 옛 데이터(접두사 없는 키)를 읽어 옮기기 위해서만 kvGet을 직접 쓴다.
// 이 파일 외에는 앱 코드에서 kvGet/kvSet을 직접 부르지 않는다 (scripts/test-isolation.mjs가 검사).
import { kvGet } from "./store";
import { SOLO_HOUSEHOLD } from "./session";
import { Settings } from "./types";

/** 구글 계정(sub) → 가정 ID */
const userKey = (sub: string) => `user:${sub}`;
/** 아이 접속 토큰 → 어느 가정의 어느 아이인지 */
const kidTokenKey = (token: string) => `kid:${token}`;

export interface KidTokenTarget {
  hh: string;
  kidId: string;
}

function randomId(len = 16): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // 헷갈리는 l,o,0,1 제외
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * 로그인한 구글 계정의 가정을 찾고, 없으면 만든다.
 *
 * 처음 로그인하는 계정이 예전(한 가정 전용)에 쓰던 데이터를 그대로 이어받도록,
 * 접두사 없는 옛 데이터가 있으면 새 가정으로 옮겨 준다.
 * 안 그러면 지금까지 쌓인 기록이 사라진 것처럼 보인다.
 */
export async function ensureHousehold(sub: string, email?: string): Promise<string> {
  const existing = await globalStore.get<string>(userKey(sub));
  if (existing) return existing;

  // 구글 로그인을 붙이기 전에 쌓인 데이터를 원래 주인이 이어받게 하는 절차.
  //
  // 여기서 주의할 점: "먼저 로그인한 사람이 가져간다"로 두면, 주인이 로그인하기 전에
  // 남이 먼저 로그인하는 순간 그 사람이 아이들 기록의 주인이 되어 버린다.
  // 그래서 OWNER_EMAIL을 정해 두면 그 계정만 이어받을 수 있게 한다.
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const claimed = await globalStore.get<string>("soloClaimedBy");
  const isOwner = !owner || owner === email?.trim().toLowerCase();

  if (!claimed && isOwner) {
    await migrateSoloData();
    await globalStore.set("soloClaimedBy", sub);
    await globalStore.set(userKey(sub), SOLO_HOUSEHOLD);
    return SOLO_HOUSEHOLD;
  }

  const hh = randomId(12);
  await globalStore.set(userKey(sub), hh);
  return hh;
}

/**
 * 구글 로그인을 붙이기 전에 쓰던 접두사 없는 키들을 'home' 가정으로 옮긴다.
 * 이미 옮겨졌으면 아무 것도 하지 않는다.
 */
export async function migrateSoloData(): Promise<{ moved: string[] }> {
  const store = storeFor(SOLO_HOUSEHOLD);
  const moved: string[] = [];

  const already = await store.get<Settings>("settings");
  const old = await kvGet<Settings>("settings");
  if (!already && old) {
    await store.set("settings", old);
    moved.push("settings");

    // 아이별 데이터도 함께 옮긴다 (아이 목록을 알아야 키를 만들 수 있다)
    for (const kid of old.kids ?? []) {
      for (const name of [`history:${kid.id}`, `wrong:${kid.id}`]) {
        const v = await kvGet<unknown>(name);
        if (v !== null && !(await store.get(name))) {
          await store.set(name, v);
          moved.push(name);
        }
      }
    }
  }
  return { moved };
}

/** 아이 전용 접속 링크 토큰을 새로 발급 (기존 토큰은 무효가 된다) */
export async function issueKidToken(hh: string, kidId: string, oldToken?: string): Promise<string> {
  if (oldToken) await globalStore.del(kidTokenKey(oldToken));
  const token = randomId(20);
  await globalStore.set(kidTokenKey(token), { hh, kidId } satisfies KidTokenTarget);
  return token;
}

export async function resolveKidToken(token: string): Promise<KidTokenTarget | null> {
  if (!/^[a-z0-9]{8,40}$/.test(token)) return null;
  return globalStore.get<KidTokenTarget>(kidTokenKey(token));
}

export async function revokeKidToken(token: string): Promise<void> {
  await globalStore.del(kidTokenKey(token));
}

/** 이 저장소에 예전 방식 데이터가 남아 있는지 (부모 화면 안내용) */
export async function hasLegacyData(): Promise<boolean> {
  return (await kvGet<Settings>("settings")) !== null;
}
