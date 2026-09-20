"use client";

import { cn } from "@/lib/cn";
import { locales, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/locale";
import { GlobeIcon } from "@/components/icons";

/**
 * 언어 선택. 4개 언어라 칩을 나열하면 390px에서 두 줄로 접히고 터치 영역도 좁아져서 select를 쓴다.
 * 각 항목은 그 언어 자체로 적어 어느 언어 화면에서도 읽힌다.
 * 접속 즉시 모달로 묻지 않는다 — 첫 화면은 브라우저 언어로 그리고, 바꾸고 싶을 때만 여기서 바꾼다.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={cn("relative inline-flex shrink-0 items-center", className)}>
      <span className="sr-only">{t.lang.group}</span>
      {/* 한국어를 못 읽는 사람에게 "한국어"라고 적힌 알약은 아무 단서가 아니다.
          기본 화살표 하나에 기대지 않도록 지구본을 붙인다. */}
      <GlobeIcon className="pointer-events-none absolute left-3.5 text-body-sm text-text-muted" />
      <select
        value={locale}
        onChange={event => setLocale(event.target.value as Locale)}
        className="min-h-11 appearance-none rounded-full border border-line-strong bg-surface py-2 pl-9 pr-10 text-label text-text"
      >
        {locales.map(value => (
          <option key={value} value={value} lang={value}>{t.lang[value]}</option>
        ))}
      </select>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-4 size-4 text-text">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
