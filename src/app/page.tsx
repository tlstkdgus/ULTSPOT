import Link from "next/link";
import { DotField, Wordmark } from "@/components/brand";
import { buttonStyles } from "@/components/ui";
import { dotPalette } from "@/design-system/tokens";

// 기획서가 들어오기 전까지 쓰는 임시 랜딩. 브랜드 톤 확인용이다.
export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <DotField
        colors={dotPalette.hero}
        count={46}
        radius={[2, 26]}
        alpha={[0.1, 0.5]}
        seed={11}
        className="absolute inset-0 opacity-55"
      />

      <header className="relative shell flex items-center justify-between py-5.5">
        <Wordmark className="text-base" />
        <span className="text-caption text-text-faint">Coming soon</span>
      </header>

      <section className="relative shell flex flex-1 flex-col justify-center pb-16">
        <h1 className="text-hero text-text">
          FIND
          <br />
          YOUR <em className="text-lime not-italic">SPOT</em>.
        </h1>
        <p className="mt-7 max-w-[34ch] text-body text-text-muted md:text-subhead md:font-normal">
          <b className="font-bold text-text">ULTSPOT</b>은 여행 날짜에 맞춰 생일카페·팝업 이벤트를 매칭해주는 K팝 팬을
          위한 AI 덕질 여행 플래너입니다.
        </p>
        <div className="mt-9 flex flex-col gap-2 sm:flex-row">
          <Link href="/design-system" className={buttonStyles({ size: "lg" })}>
            디자인 시스템 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
