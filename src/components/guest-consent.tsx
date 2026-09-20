"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

/**
 * 게스트 기록(익명 계정) 생성 동의.
 *
 * 왜 모달인가: 익명 로그인은 계정이 생기는 일이다. 버튼 한 번에 조용히 만들어지면 사용자는
 * 자기 앞으로 무엇이 생겼는지 모른 채 서버에 기록을 남기게 된다. 무엇이 만들어지고 무엇이
 * 저장되는지 읽고 나서 누르게 한다. 취소하면 아무 요청도 나가지 않는다.
 *
 * 이 화면 전체가 선택이다. 여정·체크인·가계부·발자취는 이 모달을 한 번도 열지 않아도 전부 된다.
 */
export function GuestConsent({ open, onConfirm, onCancel }: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const titleId = "guest-consent-title";
  const bodyId = "guest-consent-body";

  // Esc로 닫는다. 취소와 같은 동작이며 아무 요청도 보내지 않는다.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
        className="w-full max-w-md rounded-xl border border-line-strong bg-surface p-5"
        onClick={event => event.stopPropagation()}>
        <h2 id={titleId} className="text-subhead">{t.onSite.consentTitle}</h2>
        <p id={bodyId} className="mt-3 text-body-sm text-text-muted">{t.onSite.consentBody}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {/* autoFocus로 초점을 모달 안에 둔다. Button은 ref를 전달하지 않는다. */}
          <Button autoFocus onClick={onConfirm}>{t.onSite.consentConfirm}</Button>
          <Button variant="ghost" onClick={onCancel}>{t.onSite.consentCancel}</Button>
        </div>
      </div>
    </div>
  );
}
