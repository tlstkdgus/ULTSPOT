import type { Metadata, Viewport } from "next";
import { Unbounded } from "next/font/google";
// Pretendard는 한글 글리프가 많아 단일 파일(2MB)이 무겁다.
// unicode-range로 쪼갠 dynamic subset CSS를 써서 화면에 나온 글자 조각만 받게 한다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import { color } from "@/design-system/tokens";
import "./globals.css";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ULTSPOT — Find your spot",
    template: "%s · ULTSPOT",
  },
  description: "여행 날짜에 맞춰 생일카페·팝업 이벤트를 매칭해주는 글로벌 K팝 팬을 위한 AI 덕질 여행 플래너",
};

export const viewport: Viewport = {
  themeColor: color.ink900,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={unbounded.variable}>
      <body>{children}</body>
    </html>
  );
}
