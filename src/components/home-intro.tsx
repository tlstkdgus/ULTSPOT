"use client";

import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { ArrowRightIcon } from "@/components/icons";
import { LanguageToggle } from "@/components/language-toggle";
import { buttonStyles } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

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
      </div>

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
