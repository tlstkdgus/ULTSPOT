/**
 * 서울 기준 오늘 날짜(YYYY-MM-DD). T-059.
 *
 * `new Date().toISOString().slice(0, 10)`은 UTC 날짜라 한국 시간 오전 9시 전에는 어제가 된다. 서버의 일일 호출
 * 상한(카카오 경로·주변 검색·Jev·TourAPI·Google 사진)이 한국 시간 자정이 아니라 오전 9시에 초기화됐고, 직접 추가한
 * 행사의 확인 날짜도 새벽에는 하루 전으로 찍혔다. 제품의 모든 날짜는 한국 시간이다(화면 하단 안내).
 */
export function seoulDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
