import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { PrivacyNotice } from "@/components/privacy-notice";
import { messages } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";

/**
 * 개인정보 처리방침 (T-058). 사이트가 무엇을 어디에 보관하고 무엇을 밖으로 보내는지 전부 적는다.
 * 내용은 코드가 실제로 하는 일과 같아야 한다 — 저장소·Supabase 마이그레이션·외부 호출을 기준으로 썼다.
 * 기능이 바뀌면 이 문구와 시행일을 같이 고친다.
 */
export async function generateMetadata() {
  return { title: messages[await getLocale()].privacy.title };
}

export default async function PrivacyPage() {
  const t = messages[await getLocale()];
  return (
    <main className="shell pb-16">
      <header className="flex items-center justify-between gap-4 border-b border-line py-4">
        <Link href="/" aria-label={t.steps.home} className="inline-flex min-h-11 items-center"><Wordmark /></Link>
        <LanguageToggle />
      </header>
      <PrivacyNotice />
    </main>
  );
}
