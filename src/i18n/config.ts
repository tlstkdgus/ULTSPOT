export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ko";
/** 서버가 첫 렌더부터 같은 언어로 그리도록 localStorage 대신 쿠키에 둔다. */
export const localeCookie = "ultspot-locale";
export const isLocale = (value: unknown): value is Locale => locales.includes(value as Locale);
