"use client";

import { useI18n } from "@/i18n/locale";

/** 처리방침 본문. 언어 전환을 바로 따르도록 클라이언트에서 화면 언어로 그린다. */
export function PrivacyNotice() {
  const { t } = useI18n();
  return (
    <article className="mx-auto mt-10 max-w-[70ch]">
      <h1 className="text-heading">{t.privacy.title}</h1>
      <p className="mt-2 text-caption text-text-muted">{t.privacy.effective}</p>
      <p className="mt-6 text-body text-text-muted">{t.privacy.intro}</p>
      {t.privacy.sections.map(section => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-subhead">{section.heading}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-body-sm text-text-muted">
            {section.items.map(item => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
    </article>
  );
}
