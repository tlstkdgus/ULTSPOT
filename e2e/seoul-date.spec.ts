import { expect, test } from "@playwright/test";
import { seoulDate } from "../src/lib/seoul-date";

// T-059: 서버 일일 상한과 확인 날짜는 한국 시간 자정에 넘어가야 한다. UTC로 세면 오전 9시에 넘어갔다.
test("the day turns over at midnight in Seoul, not at midnight UTC", () => {
  expect(seoulDate(new Date("2026-09-24T14:59:59Z"))).toBe("2026-09-24"); // 23:59:59 KST
  expect(seoulDate(new Date("2026-09-24T15:00:00Z"))).toBe("2026-09-25"); // 00:00 KST
  expect(seoulDate(new Date("2026-09-24T23:30:00Z"))).toBe("2026-09-25"); // 08:30 KST — UTC로는 아직 24일
  expect(seoulDate(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
});
