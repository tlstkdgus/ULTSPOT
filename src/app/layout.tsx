import type { Metadata, Viewport } from "next";
import { Unbounded } from "next/font/google";
// Pretendard는 한글 글리프가 많아 단일 파일(2MB)이 무겁다.
// unicode-range로 쪼갠 dynamic subset CSS를 써서 화면에 나온 글자 조각만 받게 한다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import { Analytics } from "@vercel/analytics/next";
import { color } from "@/design-system/tokens";
import { htmlLang } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import "./globals.css";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  display: "swap",
});

// 언어 쿠키를 읽으므로 요청마다 렌더된다. 첫 화면부터 고른 언어로 그려서 깜빡임이 없다.
// 이전 설명의 "AI 덕질 여행 플래너·매칭"은 아직 없는 기능이라 현재 동작만 적는다.
export async function generateMetadata(): Promise<Metadata> {
  const t = messages[await getLocale()];
  return {
    title: { default: t.meta.title, template: "%s · ULTSPOT" },
    description: t.meta.description,
  };
}

export const viewport: Viewport = {
  themeColor: color.ink900,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={htmlLang[locale]} className={unbounded.variable}>
      <body>
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
        <Analytics />
      </body>
    </html>
  );
}
