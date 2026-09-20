/**
 * 일정 → iCalendar(.ics). 로그인·알림 서버 없이 사용자가 직접 캘린더 앱으로 옮기게 하는 경로다.
 * 시각은 한국 시간(UTC+9)을 UTC로 바꿔 Z 표기로 적는다. VTIMEZONE 블록을 쓰지 않아도
 * 어느 캘린더 앱에서나 같은 절대 시각을 가리킨다.
 */

const KST_OFFSET_MINUTES = 9 * 60;

/** RFC 5545: 쉼표·세미콜론·역슬래시·줄바꿈을 이스케이프한다. */
const escapeText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545: 한 줄은 75옥텟까지. UTF-8이라 글자 수가 아니라 바이트로 센다. */
function foldLine(line: string) {
  const encoder = new TextEncoder();
  let out = "";
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // 이어지는 줄은 앞에 공백 한 칸이 붙으므로 그만큼 여유를 둔다.
    if (bytes + size > (out ? 74 : 75)) { out += `${current}\r\n `; current = ""; bytes = 0; }
    current += char;
    bytes += size;
  }
  return out + current;
}

function stampUTC(date: string, minutesOfDay: number) {
  const utc = new Date(`${date}T00:00:00Z`).getTime() + (minutesOfDay - KST_OFFSET_MINUTES) * 60_000;
  return new Date(utc).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export type CalendarEvent = {
  uid: string;
  date: string;
  start: number;
  end: number;
  title: string;
  location: string;
  description: string;
};

export function buildCalendar(events: CalendarEvent[], now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ULTSPOT//Trip planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${stampUTC(event.date, event.start)}`,
      `DTEND:${stampUTC(event.date, event.end)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `LOCATION:${escapeText(event.location)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}
