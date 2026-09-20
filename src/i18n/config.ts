export const locales = ["ko", "en", "ja", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ko";
/** 서버가 첫 렌더부터 같은 언어로 그리도록 localStorage 대신 쿠키에 둔다. */
export const localeCookie = "ultspot-locale";
export const isLocale = (value: unknown): value is Locale => locales.includes(value as Locale);

/** <html lang>에 넣을 값. zh는 간체 기준으로 만들었으므로 그대로 표기한다. */
/** Intl(날짜·생일 표기)에 넘길 로케일. 화면 언어와 날짜 표기가 어긋나지 않게 한 곳에서 정한다. */
export const intlLocale: Record<Locale, string> = { ko: "ko-KR", en: "en", ja: "ja-JP", zh: "zh-CN" };

export const htmlLang: Record<Locale, string> = { ko: "ko", en: "en", ja: "ja", zh: "zh-Hans" };

/**
 * 브라우저가 보낸 Accept-Language에서 지원 언어를 고른다.
 * 쿠키가 없을 때(첫 방문)만 쓰고, 한 번 고른 선택은 언제나 이 결과를 이긴다.
 * 예: "ja,en-US;q=0.9,en;q=0.8" → ja
 */
export function matchLocale(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map(part => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find(p => p.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter(entry => entry.tag && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
    // zh-tw, zh-hk도 중국어 화면으로 보낸다. 번체 화면은 아직 없다는 것을 문서에 적는다.
    if (base === "zh") return "zh";
  }
  return null;
}
