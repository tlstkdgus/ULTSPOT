import type { Locale } from './config';

export const calendarSummary: Record<Locale, (included: number, excluded: number) => string> = {
  en: (n, x) => `${n} visits ready. ${x} excluded: no date, unresolved time or conflicts.`,
  ko: (n, x) => `${n}곳을 내보낼 수 있어요. 날짜·시각 미확정 또는 충돌이 있는 ${x}곳은 제외돼요.`,
  ja: (n, x) => `${n}件を書き出せます。日付・時刻未確定または競合のある${x}件は除外します。`,
  zh: (n, x) => `可导出 ${n} 个地点。日期或时间未定、存在冲突的 ${x} 个地点将被排除。`,
};
