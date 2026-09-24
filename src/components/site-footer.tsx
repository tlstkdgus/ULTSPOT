"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/locale";

/**
 * 모든 화면 하단 푸터 (T-058). 개인정보 처리방침으로 가는 길을 한 곳에 둔다.
 * GA를 켜면서 방문자에게 수집 항목을 알릴 곳이 필요해졌다. 사용자 결정(2026-09-25): 하단 푸터에 넣는다.
 * 언어 전환이 새로고침 없이 클라이언트 상태만 바꾸므로 서버가 아니라 화면 언어를 따른다.
 */
export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="shell border-t border-line py-6 text-caption text-text-muted">
      <nav aria-label={t.privacy.footer} className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>© 2026 ULTSPOT</span>
        <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4">{t.privacy.footer}</Link>
      </nav>
    </footer>
  );
}
