import { kvDel, kvGet, kvSet } from "./store";

/**
 * 가정별로 묶인 저장소.
 *
 * 남의 집 아이 기록이 보이는 사고를 막는 가장 확실한 방법은,
 * 호출하는 곳마다 접두사를 붙이는 게 아니라 **접두사 없는 키를 아예 못 읽게** 하는 것이다.
 * 그래서 앱 코드는 이 Store만 쓰고, kvGet/kvSet은 직접 부르지 않는다.
 * (scripts/test-isolation.mjs 가 이 규칙을 검사한다)
 */
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  /** 디버깅·검증용으로 실제 저장 키를 보여준다 */
  fullKey(key: string): string;
}

const isSafeId = (v: string) => /^[A-Za-z0-9_-]{1,64}$/.test(v);

export function storeFor(householdId: string): Store {
  if (!isSafeId(householdId)) {
    // 콜론이 섞이면 다른 가정 영역으로 넘어갈 수 있으므로 형식을 강제한다
    throw new Error(`잘못된 householdId: ${householdId}`);
  }
  const prefix = `hh:${householdId}:`;
  return {
    get: <T>(key: string) => kvGet<T>(prefix + key),
    set: (key, value) => kvSet(prefix + key, value),
    del: (key) => kvDel(prefix + key),
    fullKey: (key) => prefix + key,
  };
}

/**
 * 가정에 속하지 않는 전역 키(계정 → 가정 연결, 아이 링크 등) 전용.
 * 아이 학습 데이터에는 절대 쓰지 않는다.
 */
export const globalStore = {
  get: <T>(key: string) => kvGet<T>(`g:${key}`),
  set: (key: string, value: unknown) => kvSet(`g:${key}`, value),
  del: (key: string) => kvDel(`g:${key}`),
};
