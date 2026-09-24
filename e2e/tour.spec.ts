import { expect, test } from "@playwright/test";
import { parseClosedDays, parseOpeningHours, parseTourIntro, parseTourRow } from "../src/lib/recommend/tour";
import { suggestionFacts } from "../src/lib/recommend/nearby";
import { fitInGap, isClosedOn } from "../src/lib/trip/gap-fill";
import { tourPhoto } from "../src/lib/recommend/photo";

/**
 * TourAPI 원문 해석 (T-050). 아래 문장은 전부 2026-09-24에 명동·홍대·성수 주변을 실제로 조회해 받은 원문이다.
 * 확실히 읽히는 것만 시간으로 쓰고, 나머지는 모른다고 둔다(null).
 */
test("opening hours are read only when the text is unambiguous", () => {
  const h = (m: string) => { const [a, b] = m.split(":").map(Number); return a * 60 + b; };
  expect(parseOpeningHours("11:00~22:00")).toEqual({ opens: h("11:00"), closes: h("22:00"), breaks: [] });
  // 마지막 주문이 있으면 그 시각까지만 잡는다. 앞에 쓰든 뒤에 쓰든.
  expect(parseOpeningHours("11:30~22:00 (21:20 라스트오더)")).toMatchObject({ opens: h("11:30"), closes: h("21:20") });
  expect(parseOpeningHours("10:30~21:00 (마지막 주문 20:30)")).toMatchObject({ closes: h("20:30") });
  expect(parseOpeningHours("10:00~17:00 (입장마감 16:30)")).toMatchObject({ closes: h("16:30") });
  // 준비시간은 따로 둔다.
  expect(parseOpeningHours("- 11:30~21:00<br>- 준비시간(평일) 15:30~16:30<br>- 마지막 주문 20:30"))
    .toEqual({ opens: h("11:30"), closes: h("20:30"), breaks: [[h("15:30"), h("16:30")]] });
  expect(parseOpeningHours("- 11:00~21:00<br>- 준비시간 15:00~17:00")).toMatchObject({ breaks: [[h("15:00"), h("17:00")]] });
  // 자정을 넘기면 그날 끝까지.
  expect(parseOpeningHours("- 17:00~24:00<br>- 마지막 주문 22:30")).toMatchObject({ opens: h("17:00"), closes: h("22:30") });
  expect(parseOpeningHours("08:10~24:00")).toMatchObject({ closes: 1440 });
  expect(parseOpeningHours("상시 개방")).toEqual({ opens: 0, closes: 1440, breaks: [] });
  expect(parseOpeningHours("24시간")).toEqual({ opens: 0, closes: 1440, breaks: [] });
  expect(parseOpeningHours("매일 10:00 ~ 20:00")).toMatchObject({ opens: h("10:00"), closes: h("20:00") });
  expect(parseOpeningHours("- 11:00~23:00<br>- 마지막 주문 21:30<br>※ 재료 소진 시 조기 마감")).toMatchObject({ closes: h("21:30") });

  // 계절·요일별, 점포별, 예약, 공연·전시에 따라 다른 곳은 모른다고 둔다.
  for (const unsure of [
    "- 하절기(04~10월) 09:00~21:00<br> - 동절기(11~03월) 09:00~20:00",
    "- 하절기(4월~10월) 09:00~21:00<br> - 동절기(11월~3월) 09:00~20:00",
    "화 ~ 토 12:00 - 18:00",
    "- 일요일~목요일 11:00~01:00<br>- 금요일~토요일 11:00~02:00",
    "- 월요일~화요일 / 목요일~일요일 10:00~22:50<br>- 수요일 10:00~22:35",
    "10:00~22:00 <br> ※ 점포 별로 상이함",
    "10:00~17:00 (입장마감 16:30)<br> ※ 사전 예약 필수",
    "11:00~ 23:00 ※예약 등 자세한 사항은 홈페이지 참조 요망",
    "09:00~21:00 <br>※ 공연이 있는 날은 공연 종료 시간에 맞춰 운영 종료",
    "공연 별로 상이함",
    "※ 전시마다 상이하므로 전화문의 요망",
    "",
  ]) expect(parseOpeningHours(unsure), unsure).toBeNull();
});

test("closed days: weekdays are decided, holidays are passed on as text", () => {
  expect(parseClosedDays("연중무휴")).toEqual({ closedDays: [], note: "" });
  expect(parseClosedDays("매주 화요일")).toEqual({ closedDays: [2], note: "" });
  expect(parseClosedDays("매주 월요일~수요일 / 설·추석 당일")).toEqual({ closedDays: [1, 2, 3], note: "매주 월요일~수요일 / 설·추석 당일" });
  expect(parseClosedDays("매주 토요일~일요일")).toEqual({ closedDays: [0, 6], note: "" });
  expect(parseClosedDays("매주 일요일, 월요일 정기휴무")).toEqual({ closedDays: [0, 1], note: "" });
  expect(parseClosedDays("매주 월요일~화요일")).toEqual({ closedDays: [1, 2], note: "" });
  expect(parseClosedDays(`${String.fromCharCode(0xfeff)}설·추석 당일`)?.closedDays).toEqual([]);
  expect(parseClosedDays("1월 1일 / 설·추석 연휴")?.note).toContain("설·추석");
  expect(parseClosedDays("매주 월요일(단, 월요일이 공휴일일 경우 익일 휴관)")?.closedDays).toEqual([1]);
  for (const unsure of ["점포 별로 상이함", "※ 프로그램마다 상이하므로 홈페이지 참조", "공연 별로 상이함", "", "격주 수요일"])
    expect(parseClosedDays(unsure), unsure).toBeNull();
});

test("a TourAPI row becomes a candidate of the right kind, and hours need both fields", () => {
  const anchor = { lat: 37.56072, lng: 126.98659 };
  const row = { contentid: "1234", contenttypeid: "39", title: "왕비집", mapx: "126.9857", mapy: "37.5612", dist: "101.2", cat3: "A05020100", addr1: "서울특별시 중구", modifiedtime: "20250103154547" };
  const meal = parseTourRow(row, "meal", anchor, 800)!;
  expect(meal).toMatchObject({ id: "tour-1234", kind: "meal", straightMeters: 101, hoursKnown: false, hours: null });
  // 화면 링크 문구가 "카카오맵에서 보기"다. 관광공사 페이지로 보내지 않는다.
  expect(meal.placeUrl).toMatch(/^https:\/\/map\.kakao\.com\/link\/map\//);
  expect(meal.tour).toEqual({ contentId: "1234", contentTypeId: "39", modified: "2025-01-03" });
  // 카페(A05020900)는 식사가 아니고, 식당은 카페가 아니다.
  expect(parseTourRow(row, "cafe", anchor, 800)).toBeNull();
  expect(parseTourRow({ ...row, cat3: "A05020900" }, "meal", anchor, 800)).toBeNull();
  expect(parseTourRow({ ...row, cat3: "A05020900" }, "cafe", anchor, 800)?.kind).toBe("cafe");
  expect(parseTourRow({ ...row, dist: "900" }, "meal", anchor, 800)).toBeNull();
  expect(parseTourRow({ ...row, mapx: "0" }, "meal", anchor, 800)).toBeNull();

  const hours = parseTourIntro({ opentimefood: "11:30~22:00 (21:20 라스트오더)", restdatefood: "매주 화요일" }, "39", "2025-01-03")!;
  expect(hours).toMatchObject({ opens: 690, closes: 1280, closedDays: [2], modified: "2025-01-03" });
  expect(parseTourIntro({ opentimefood: "11:30~22:00", restdatefood: "" }, "39")).toBeNull();
  expect(parseTourIntro({ usetimeculture: "10:00~18:00", restdateculture: "매주 월요일" }, "14")).toMatchObject({ closedDays: [1] });
  // Jev에는 확인된 시간만 사실로 간다.
  expect(suggestionFacts({ ...meal, hours, hoursKnown: true })).toContain("영업 11:30–21:20");
  expect(suggestionFacts(meal)).toContain("영업시간 미확인");
});

test("known hours move the arrival to opening, avoid breaks and leave by closing", () => {
  const hours = { opens: 690, closes: 1230, breaks: [[900, 1020]] as [number, number][] };
  // 11:00에 도착할 수 있어도 11:30에 연다.
  expect(fitInGap({ start: 640, end: 1080 }, 20, 0, 60, hours)).toEqual({ arrival: 690, departure: 750, stay: 60 });
  // 14:40 도착이면 15:00 준비시간 전에 떠나야 한다 → 20분뿐이라 넣지 않는다.
  expect(fitInGap({ start: 860, end: 1080 }, 20, 0, 60, hours)).toBeNull();
  // 준비시간 중에 닿으면 끝날 때까지 기다린다.
  expect(fitInGap({ start: 910, end: 1200 }, 10, 0, 60, hours)).toEqual({ arrival: 1020, departure: 1080, stay: 60 });
  // 닫기 40분 전이면 40분만 머문다.
  expect(fitInGap({ start: 1170, end: 1400 }, 20, 0, 60, hours)).toEqual({ arrival: 1190, departure: 1230, stay: 40 });
  expect(isClosedOn({ closedDays: [2] }, "2026-09-22")).toBe(true); // 화요일
  expect(isClosedOn({ closedDays: [2] }, "2026-09-23")).toBe(false);
  expect(isClosedOn(null, "2026-09-22")).toBe(false);
});

test("a photo is kept only from the tourism image server and only with a known licence", () => {
  // 실제 응답 형식: http 주소 + cpyrhtDivCd. 화면이 https라 https로 바꾼다.
  expect(tourPhoto("http://tong.visitkorea.or.kr/cms/resource/54/684154_image2_1.jpg", "Type3"))
    .toEqual({ url: "https://tong.visitkorea.or.kr/cms/resource/54/684154_image2_1.jpg", provider: "tour", license: "kogl-3", authors: [] });
  expect(tourPhoto("https://tong.visitkorea.or.kr/a.jpg", "Type1")?.license).toBe("kogl-1");
  // 이용 조건을 모르면 싣지 않는다.
  expect(tourPhoto("http://tong.visitkorea.or.kr/a.jpg", "")).toBeNull();
  expect(tourPhoto("http://tong.visitkorea.or.kr/a.jpg", "Type2")).toBeNull();
  // 관광공사 이미지 서버가 아니면 싣지 않는다.
  expect(tourPhoto("https://example.com/tong.visitkorea.or.kr/a.jpg", "Type1")).toBeNull();
  expect(tourPhoto("", "Type1")).toBeNull();
  expect(tourPhoto(undefined, "Type1")).toBeNull();

  const anchor = { lat: 37.56072, lng: 126.98659 };
  const row = { contentid: "1", contenttypeid: "39", title: "왕비집", mapx: "126.9857", mapy: "37.5612", dist: "101", cat3: "A05020100",
    firstimage: "http://tong.visitkorea.or.kr/cms/resource/1/1_image2_1.jpg", cpyrhtDivCd: "Type3" };
  expect(parseTourRow(row, "meal", anchor, 800)?.photo?.url).toBe("https://tong.visitkorea.or.kr/cms/resource/1/1_image2_1.jpg");
});
