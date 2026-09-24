/**
 * 영업시간 짧은 표기("11:30–21:20"). 서버(Jev 사실 문장)와 화면이 같이 쓴다.
 * tour.ts는 키를 읽는 서버 전용 모듈이라 화면이 import하지 않도록 따로 둔다.
 */
export const hoursLabel = (hours: { opens: number; closes: number }) => {
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return hours.opens === 0 && hours.closes === 1440 ? "24h" : `${hm(hours.opens)}–${hm(hours.closes)}`;
};
