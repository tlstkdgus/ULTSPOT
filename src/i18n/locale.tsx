"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { defaultLocale, htmlLang, localeCookie, type Locale } from "./config";
import { messages } from "./messages";

const LocaleContext = createContext<{ locale: Locale; setLocale: (next: Locale) => void } | null>(null);

/**
 * 언어 전환은 클라이언트 상태만 바꾼다. 새로고침·라우터 refresh를 하지 않으므로
 * 플래너에 입력 중인 날짜·선택·개인 행사가 그대로 남는다. 쿠키는 다음 요청의 서버 렌더용.
 */
export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setState] = useState(initial);
  const setLocale = useCallback((next: Locale) => {
    setState(next);
    document.cookie = `${localeCookie}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = htmlLang[next];
  }, []);
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const context = useContext(LocaleContext);
  const locale = context?.locale ?? defaultLocale;
  return { locale, setLocale: context?.setLocale ?? (() => {}), t: messages[locale] };
}
