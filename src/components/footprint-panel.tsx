"use client";

import { useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { CameraIcon, PinIcon } from "@/components/icons";
import { useI18n } from "@/i18n/locale";
import { intlLocale } from "@/i18n/config";
import { artists } from "@/lib/trip/artists";
import { eventCopy, type DataLocale } from "@/lib/trip/event-copy";
import { footprint } from "@/lib/trip/footprint";
import { CARD_HEIGHT, CARD_WIDTH, drawFootprintCard, footprintCardText } from "@/lib/trip/footprint-card";
import type { Journey } from "@/lib/trip/journey";
import { formatKrw } from "@/lib/trip/spending";

/**
 * 발자취. 사용자가 "다녀왔어요"로 표시한 방문만으로 만든다.
 *
 * 계정이 필요 없다. 집계는 브라우저 안에서 계산하고, 공유 카드도 브라우저 canvas가 그려
 * 기기에 내려받는다. 서버는 이 여행을 모르고, 공유 주소도 만들지 않는다.
 */
export function FootprintPanel({ journey, locale, notice }: {
  journey: Journey;
  locale: DataLocale;
  notice: (message: string) => void;
}) {
  const { locale: uiLocale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const result = useMemo(() => footprint(journey), [journey]);

  const money = (amountKrw: number) => formatKrw(amountKrw, intlLocale[uiLocale]);
  const artistNames = (journey.artistIds ?? [])
    .map(id => artists.find(artist => artist.id === id)?.name)
    .filter((name): name is string => !!name)
    .join(", ");
  const title = (index: number) => {
    const place = result.timeline[index].place;
    return place.event ? eventCopy(place.event, locale).title : place.title;
  };

  const card = useMemo(() => footprintCardText(result, {
    places: t.footprint.places, visits: t.footprint.visits, days: t.footprint.days,
    following: t.footprint.following, spent: t.footprint.spent, noDistance: t.footprint.noDistance,
    money, artistNames,
  // money와 t는 locale에서 파생된다. locale이 바뀌면 다시 만든다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [result, uiLocale, artistNames]);

  /** 카드를 PNG로 만든다. 실패하면 그 사실을 말하고 기록은 건드리지 않는다. */
  async function makeCard(): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // 폰트가 준비되면 지정한 글꼴로 그린다. 준비되지 않아도 대체 글꼴로 그리고 글자는 남는다.
    try { await document.fonts?.ready; } catch { /* 글꼴 상태를 알 수 없어도 계속 그린다. */ }
    drawFootprintCard(ctx, card);
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), "image/png"));
  }

  function save(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ultspot-footprint-${journey.startDate}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await makeCard();
      if (!blob) { notice(t.footprint.cardFailed); return; }
      save(blob);
    } catch { notice(t.footprint.cardFailed); }
    finally { setBusy(false); }
  }

  /** Web Share를 쓸 수 있으면 공유하고, 쓸 수 없거나 실패하면 내려받기로 떨어진다. */
  async function share() {
    setBusy(true);
    try {
      const blob = await makeCard();
      if (!blob) { notice(t.footprint.cardFailed); return; }
      const file = new File([blob], `ultspot-footprint-${journey.startDate}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: t.footprint.title });
          return;
        } catch (error) {
          // 사용자가 공유 시트를 닫은 것은 오류가 아니다. 그때는 내려받지도 않는다.
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      save(blob);
      notice(t.footprint.shareFailed);
    } catch { notice(t.footprint.cardFailed); }
    finally { setBusy(false); }
  }

  return (
    <section aria-label={t.footprint.title} className="mt-4 rounded-xl border border-line-strong p-4 sm:p-5">
      <h2 className="text-label">{t.footprint.title}</h2>
      <p className="mt-1 text-caption text-text-muted">{t.footprint.lead}</p>

      {result.visits === 0 ? <p className="mt-3 text-body-sm text-text-muted">{t.footprint.empty}</p> : <>
        <p className="mt-3 text-subhead">{card.headline}</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-muted">
          {card.stats.map(stat => <li key={stat}>{stat}</li>)}
        </ul>

        <ol className="mt-4 space-y-2">
          {result.timeline.map((item, index) => <li key={`${item.place.id}-${item.on}`}
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-body-sm">
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-text text-bg text-caption">
              {index + 1}
            </span>
            <span className="min-w-0 truncate">{title(index)}</span>
            <span className="text-caption text-text-muted">{item.on}</span>
            {/* 좌표가 없는 곳은 그렇다고 적는다. 지도에 찍히지 않는 이유를 숨기지 않는다. */}
            {!item.place.coord && <Badge tone="closing">{t.journey.noCoord}</Badge>}
          </li>)}
        </ol>

        {/* 거리를 적지 않는 이유를 화면에서도 말한다. 빠뜨린 게 아니라 정한 것이다. */}
        <p className="mt-4 flex items-start gap-2 text-caption text-text-faint">
          <PinIcon />{t.footprint.noDistance}
        </p>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-line-strong pt-4">
          <Button variant="primary" size="sm" disabled={busy} onClick={share}>
            <CameraIcon />{busy ? t.footprint.building : t.footprint.share}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={download}>
            {t.footprint.download}
          </Button>
        </div>
      </>}
    </section>
  );
}
