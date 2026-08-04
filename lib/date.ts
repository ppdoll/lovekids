const KST_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 서버가 어느 시간대에 있든 한국 기준 오늘 날짜(YYYY-MM-DD)를 돌려준다. */
export function todayKST(): string {
  return KST_FMT.format(new Date());
}

/** 한국 기준 n일 전 날짜(YYYY-MM-DD) */
export function daysAgoKST(n: number): string {
  return KST_FMT.format(new Date(Date.now() - n * 86400000));
}
