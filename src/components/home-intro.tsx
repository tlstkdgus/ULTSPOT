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

    <section className="relative shell flex flex-1 flex-col justify-center pt-8 pb-12">
      {/* 슬로건은 브랜드 표기라 두 언어 모두 영어로 둔다. */}
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
        <span className="text-body-sm text-text-muted">{t.home.badge}</span>
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
      <p className="mt-8 max-w-[60ch] text-body-sm text-text-muted">{t.home.honesty}</p>
    </section>
  </>;
}
