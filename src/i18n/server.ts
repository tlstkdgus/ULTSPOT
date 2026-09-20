import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, localeCookie, matchLocale, type Locale } from "./config";

/**
 * 고른 값(쿠키) > 브라우저 언어(Accept-Language) > 기본값(영어) 순서.
 * 외국 팬이 첫 화면부터 자기 언어로 보고, 한국 사용자는 한국어로 본다.
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(localeCookie)?.value;
  if (isLocale(chosen)) return chosen;
  return matchLocale((await headers()).get("accept-language")) ?? defaultLocale;
}
