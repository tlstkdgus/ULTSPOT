"use client";

import { cn } from "@/lib/cn";
import { locales, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/locale";

/**
 * 언어 선택. 4개 언어라 칩을 나열하면 390px에서 두 줄로 접히고 터치 영역도 좁아져서 select를 쓴다.
 * 각 항목은 그 언어 자체로 적어 어느 언어 화면에서도 읽힌다.
 * 접속 즉시 모달로 묻지 않는다 — 첫 화면은 브라우저 언어로 그리고, 바꾸고 싶을 때만 여기서 바꾼다.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={cn("inline-flex items-center gap-2", className)}>
      <span className="sr-only">{t.lang.group}</span>
      <select
        value={locale}
        onChange={event => setLocale(event.target.value as Locale)}
        className="min-h-11 rounded-full border border-line-strong bg-surface px-4 text-label text-text"
      >
        {locales.map(value => (
          <option key={value} value={value} lang={value}>{t.lang[value]}</option>
        ))}
      </select>
    </label>
  );
}
