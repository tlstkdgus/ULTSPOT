"use client";

import Link from "next/link";
import { MapBanner, Wordmark } from "@/components/brand";
import { ArrowDownIcon, ArrowRightIcon } from "@/components/icons";
import { LanguageToggle } from "@/components/language-toggle";
import { buttonStyles } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

/**
 * 배너의 도시 라벨. 브랜드 표기라 번역하지 않는다 — 워드마크의 "ULTSPOT",
 * 목업의 "SEOUL" · "FAN TRAVEL FOOTPRINT"와 같은 층위다. 사전에 넣지 않는 이유도 그것이다.
 */
const BRAND_CITY = "SEOUL";

export function HomeIntro() {
  const { t } = useI18n();
  return <>
    <header className="relative shell flex items-center justify-between gap-4 py-4">
      <Wordmark className="text-base" />
      <LanguageToggle />
    </header>

    <section className="relative shell flex flex-1 flex-col pb-12">
      {/* 첫 화면은 슬로건과 시작 버튼까지만 보이게 한다. 이 블록이 남은 높이를 채우므로
          지도 배너는 항상 접힌 자리 아래에서 시작한다. 이전에는 배너가 화면 하단에
          반쯤 걸려 잘린 채로 보였다. */}
      {/* flex-1만으로는 늘어나지 않는다 — 페이지 전체가 이미 뷰포트보다 길어 남는 공간이 없다.
          넓은 화면에서만 높이를 명시해 배너를 접힌 자리 아래로 민다. 모바일은 그대로 둔다. */}
      <div className="flex flex-1 flex-col justify-center pt-8 md:min-h-[calc(100dvh-4rem)]">
        {/* 슬로건은 브랜드 표기라 어느 언어에서도 영어로 둔다. */}
        {/* 줄바꿈 때문에 접근성 이름이 "FINDYOUR SPOT."으로 붙어 읽히던 것을 aria-label로 고정한다. */}
        <h1 lang="en" aria-label="Find your spot." className="text-hero text-text">
          FIND
          <br />
          YOUR <em className="text-lime not-italic">SPOT</em>.
        </h1>
        <p className="mt-7 max-w-[36ch] text-body text-text md:text-subhead md:font-normal">{t.home.lead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/plan" className={buttonStyles({ size: "lg" })}>
            {t.home.cta} <ArrowRightIcon />
          </Link>
        </div>
        {/* 넓은 화면에서 히어로가 첫 화면을 다 차지하면 아래에 더 있다는 걸 알 길이 없다.
            배너를 살짝 보이게 하는 대안은 대표 이미지에 지도가 다시 들어와서 버렸다.
            장식이라 스크린리더에는 숨긴다 — 스크롤은 원래 되는 동작이다. */}
        <div aria-hidden="true" className="mt-auto hidden justify-start pt-10 text-text-faint md:flex">
          <ArrowDownIcon className="animate-dot-pulse text-subhead" />
        </div>
      </div>

      {/* 기준 목업의 첫인상 — "서울 곳곳에 스팟이 흩어져 있다". 지역 이름과 개수는
          목업이 스스로 예시라고 적은 값이라 넣지 않는다. 자세한 것은 MapBanner 주석 참고. */}
      <MapBanner label={BRAND_CITY} className="mt-12" />

      <h2 className="mt-14 text-label text-text-muted">{t.home.howTitle}</h2>
      <ol className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-3">
        {t.home.how.map((step, index) => (
          <li key={step.title} className="flex gap-4 border-t border-line-strong pt-4">
            <span aria-hidden="true" className="font-display text-subhead text-text-faint">{index + 1}</span>
            <div>
              <p className="text-subhead">{step.title}</p>
              <p className="mt-1 max-w-[40ch] text-body-sm text-text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  </>;
}
