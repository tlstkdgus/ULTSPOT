"use client";

import Link from "next/link";
import { MapBanner, Wordmark } from "@/components/brand";
import { ArrowRightIcon } from "@/components/icons";
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
      {/* 히어로 높이를 강제하지 않는다. 사용자 요청으로 "이렇게 만들어요"가 첫 화면에
          같이 보인다. 지도 배너는 그 아래라 대표 이미지(1280×720)에는 여전히 안 들어온다. */}
      <div className="flex flex-col pt-8">
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
      </div>

      {/* 설명이 장식보다 먼저다. 제품이 무엇인지 읽고 나서 분위기를 본다.
          4단계라 데스크톱은 4열, 모바일은 한 열. 설명 줄은 한 줄로 유지한다 — 4개 × 3줄이면
          390px에서 화면 하나를 통째로 먹는다. */}
      <h2 className="mt-14 text-label text-text-muted">{t.home.howTitle}</h2>
      <ol className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {t.home.how.map((step, index) => (
          <li key={step.title} className="flex gap-4 border-t border-line-strong pt-4">
            <span aria-hidden="true" className="font-display text-subhead text-text-faint">{index + 1}</span>
            <div>
              <p className="text-subhead">{step.title}</p>
              <p className="mt-1 text-body-sm text-text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* 기준 목업의 첫인상 — "서울 곳곳에 스팟이 흩어져 있다". 지역 이름과 개수는
          목업이 스스로 예시라고 적은 값이라 넣지 않는다. 자세한 것은 MapBanner 주석 참고.
          페이지를 닫는 그림으로 맨 아래에 둔다. */}
      <MapBanner label={BRAND_CITY} className="mt-14" />
    </section>
  </>;
}
