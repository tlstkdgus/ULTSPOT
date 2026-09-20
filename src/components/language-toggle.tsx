"use client";

import { cn } from "@/lib/cn";
import { locales } from "@/i18n/config";
import { useI18n } from "@/i18n/locale";

/** 한국어/English 전환. 각 버튼 이름은 그 언어 자체로 적어 어느 언어 화면에서도 읽힌다. */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t.lang.group} className={cn("inline-flex rounded-full border border-line-strong p-1", className)}>
      {locales.map(value => (
        <button key={value} type="button" lang={value} aria-pressed={locale === value} onClick={() => setLocale(value)}
          className={cn("min-h-11 rounded-full px-3.5 text-label transition-colors",
            locale === value ? "bg-text text-bg" : "text-text-muted hover:text-text")}>
          {t.lang[value]}
        </button>
      ))}
    </div>
  );
}
