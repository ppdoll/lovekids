/**
 * 가족 코드 비교용 정규화.
 * 한글은 기기·OS마다 자모 조합 방식(NFC/NFD)이 달라서, 눈에 똑같아 보이는 글자가
 * 바이트로는 다를 수 있다. 정규화하지 않으면 "맞는 코드인데 안 들어가지는" 현상이 생긴다.
 */
export function normalizeCode(v: string | undefined | null): string {
  if (!v) return "";
  return v.normalize("NFC").trim();
}
