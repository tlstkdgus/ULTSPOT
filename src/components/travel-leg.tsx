"use client";

import { ExternalIcon } from "@/components/icons";
import { useI18n } from "@/i18n/locale";
import { translateLib } from "@/i18n/messages";
import { intlLocale } from "@/i18n/config";
import type { TravelEstimate } from "@/lib/trip/travel";

/**
 * 구간 하나. **조회된 이동시간과 계획용 여유 시간을 절대 같은 모양으로 보여주지 않는다.**
 *
 * known: 분·이동수단·환승·요금·조회 시각. 실제로 물어본 값이다.
 * unconfirmed: "이동시간 미확인 · 계획용 여유 N분" + 사유 + 직접 확인 링크.
 *   미확인을 정확한 동선처럼 보이게 하면 팬이 일정을 믿고 갔다가 놓친다.
 */
export function TravelLeg({ estimate, bufferMinutes, lookingUp = false }: {
  estimate: TravelEstimate | null;
  bufferMinutes: number;
  /** 조회가 진행 중인지. 진행 중이면 "조회하지 않았어요" 같은 확정 사유를 보여주지 않는다. */
  lookingUp?: boolean;
}) {
  const { locale, t } = useI18n();

  // 출발 위치를 넣지 않아 첫 구간 이동을 세지 않은 경우. 숫자를 만들지 않고 아무 말도 하지 않는다.
  if (!estimate) return null;

  if (estimate.status === "known") {
    const time = new Intl.DateTimeFormat(intlLocale[locale], {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul",
    }).format(new Date(estimate.fetchedAt));
    return (
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-caption text-text-muted">
        <span aria-hidden="true" className="h-4 w-px bg-line-strong" />
        <span className="text-text">{estimate.mode === "walk" ? t.travel.walk : t.travel.transit} {t.travel.minutes(estimate.minutes)}</span>
        {estimate.transfers !== null && estimate.mode !== "walk" && <span>· {t.travel.transfers(estimate.transfers)}</span>}
        {estimate.fareKrw !== null && estimate.fareKrw > 0 && <span>· {t.travel.fare(estimate.fareKrw)}</span>}
        <span>· {t.travel.checked(time)}</span>
        <a href={estimate.manualUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
          {t.travel.manual} <ExternalIcon />
        </a>
      </p>
    );
  }

  // 조회가 도는 동안은 아직 결론이 아니다. 확정 사유 대신 진행 중임을 알린다.
  if (lookingUp) {
    return (
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-caption text-text-muted">
        <span aria-hidden="true" className="h-4 w-px bg-line-strong" />
        <span>{t.travel.lookingUp}</span>
      </p>
    );
  }

  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-caption text-warning">
      <span aria-hidden="true" className="h-4 w-px bg-line-strong" />
      <span>{t.travel.unconfirmed(estimate.bufferMinutes || bufferMinutes)}</span>
      <span className="text-text-muted">· {translateLib(t, estimate.reason)}</span>
      <a href={estimate.manualUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1 text-text underline underline-offset-4">
        {t.travel.manual} <ExternalIcon />
      </a>
    </p>
  );
}
