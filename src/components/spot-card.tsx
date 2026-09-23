"use client";
import { reportedEvents } from '@/i18n/reported-events';
import { FanEventArt } from '@/components/fan-event-art';
import Image from 'next/image';

// 원본 PNG(1.4~2.5MB)를 고품질 WebP(q90)로 바꿨다. next/image가 브라우저엔 어차피 WebP를 내보내므로
// 화질은 같고, 서버가 막 뜬 직후 첫 최적화가 20초를 넘겨 포스터 검사가 세 번 깨지던 원인을 없앤다(T-047).
const cardImages: Record<string, string> = {
  'hikr-ground': '/images/hikr-ground.jpg',
  'BC-SEUNGMIN-AUTUMN-BREAK': '/images/seungmin-autumn.webp',
  'BC-SEUNGMIN-DANDY-BOY': '/images/seungmin-dandy.webp',
  'BC-KYUNGMIN-CURIOUS-ANGEL': '/images/kyungmin-cafe.webp',
  'music-korea': '/images/music-korea.webp',
  'k-star-road': '/images/k-star-road.webp',
};

import { Badge, Button, type BadgeTone } from "@/components/ui";
import { CameraIcon, CheckIcon, ClockIcon, ExternalIcon, PinIcon, PlusIcon, TrainIcon } from "@/components/icons";
import { useI18n } from "@/i18n/locale";
import { translateLib } from "@/i18n/messages";
import { cn } from "@/lib/cn";
import { clock, unavailableReason, type FanEvent } from "@/lib/trip/planner";
import { eventCopy, type DataLocale } from "@/lib/trip/event-copy";

export type SpotStatus = "open" | "closed" | "unconfirmed" | "reservation";

/**
 * 결과 화면에서야 알 수 있던 제외 사유를 고르기 전에 보여준다.
 * 판정은 lib의 unavailableReason이 원천이고, 아래 분기는 그 사유를 뱃지 종류로 나누기만 한다.
 */
export function spotStatus(event: FanEvent, date: string): SpotStatus {
  if (!unavailableReason(event, date)) return "open";
  if (event.closedDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) return "closed";
  if (event.opens === null || event.closes === null) return "unconfirmed";
  if (event.reservation) return "reservation";
  return "closed";
}

const tone: Record<SpotStatus, BadgeTone> = { open: "ongoing", closed: "closed", unconfirmed: "closing", reservation: "closing" };

const mapLinks = (address: string) => [
  { key: "naver" as const, href: `https://map.naver.com/p/search/${encodeURIComponent(address)}` },
  { key: "kakao" as const, href: `https://map.kakao.com/link/search/${encodeURIComponent(address)}` },
  { key: "google" as const, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` },
];

export function SpotCard({ event, date, selected, disabled, onToggle, required = false, onToggleRequired }: {
  event: FanEvent; date: string; selected: boolean; disabled: boolean; onToggle: () => void;
  /** 필수 방문 지정 여부. 담은 곳에만 쓸 수 있다. */
  required?: boolean;
  onToggleRequired?: () => void;
}) {
  const { locale, t } = useI18n();
  // T-027에서 장소 데이터가 ja·zh까지 늘었다. eventCopy가 초안 번역은 영어로 떨어뜨린다.
  const dataLocale: DataLocale = locale;
  const status = spotStatus(event, date);
  const personal = event.provenance.mode === "personal";
  // 분류는 우리가 만든 라벨이지 수집한 원문이 아니라, 오역 위험 논리가 적용되지 않는다.
  // 한국어에만 걸어두는 바람에 일본어·중국어 번역이 있는데도 화면에 닿지 않았다.
  const kind = t.kinds[event.kind] || event.kind;
  const copy = eventCopy(event, dataLocale);
  // 한국어 원문이 있으면 그대로, 없으면 영어 원문이 나온다. 사용자가 쓴 개인 행사는 언어를 알 수 없다.
  // 영어 원문일 때만 lang을 붙여 스크린리더가 한국어로 읽지 않게 한다.
  const langOf = (korean?: string) => (personal || (locale === "ko" && korean) ? undefined : "en");
  // 영어 원문을 남기는 것은 의도된 선택인데, 화면에서는 미완성 번역과 구분되지 않았다.
  // 영어 화면에서는 설명할 것이 없고, 개인 행사는 사용자가 쓴 글이라 해당 없다.
  const showsEnglishSource = !personal && locale !== "en" && langOf(event.do_ko) === "en";
  const closedDays = event.closedDays.length
    ? event.closedDays.map(day => t.spots.weekdays[day]).join(", ")
    : t.spots.openEveryDay;
  const hours = event.opens !== null && event.closes !== null ? t.spots.hours(clock(event.opens), clock(event.closes)) : t.spots.hoursUnknown;

  return (
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors",
      selected ? "border-text" : "border-line-strong")}>
      {cardImages[event.id] ? <a href={cardImages[event.id]} target="_blank" rel="noopener noreferrer" className={`relative block overflow-hidden border-b border-line-strong bg-surface-2 ${event.category === 'birthdayCafe' ? 'aspect-[5/7]' : 'aspect-[4/3]'}`}>
        <Image src={cardImages[event.id]} alt={copy.title} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className={event.category === 'birthdayCafe' || event.id === 'hikr-ground' ? 'object-contain' : 'object-cover'} />
      </a> : event.category === 'birthdayCafe' ? <FanEventArt title={copy.title} date={`${event.from ?? ''} — ${event.to ?? ''}`} variant={event.id.includes('DANDY') ? 1 : 0} locale={locale} /> : <div className="flex h-24 flex-col items-center justify-center gap-1 border-b border-line-strong bg-surface-2 text-text-muted">
        <CameraIcon className="text-subhead" />
        <span className="text-caption">{t.spots.photoPending}</span>
      </div>}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone[status]}>{t.status[status]}</Badge>
          {event.provenance.mode === 'reported' && <Badge tone="accent">{reportedEvents[locale]}</Badge>}
          {personal && <Badge tone="accent">{t.status.personal}</Badge>}
          {required && <Badge tone="accent">{t.musts.badge}</Badge>}
          {selected && <span className="inline-flex items-center gap-1 text-caption text-text"><CheckIcon />{t.spots.added}</span>}
        </div>
        <h3 className="mt-3 text-subhead" lang={langOf(event.title_ko)}>{copy.title}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5"><ClockIcon />{hours}</span>
          {event.lastEntry !== undefined && <span>{t.spots.lastEntry(clock(event.lastEntry))}</span>}
          <span className="inline-flex items-center gap-1.5"><PinIcon /><span lang={langOf(event.area_ko)}>{copy.area}</span> · {kind}</span>
        </p>
        {event.transit && (
          <p className="mt-2 flex items-start gap-1.5 text-body-sm text-text-muted">
            <TrainIcon className="mt-0.5 shrink-0" />
            {t.spots.transit(
              locale === "ko" ? event.transit.station_ko : event.transit.station_en,
              locale === "ko" ? event.transit.line_ko : event.transit.line_en,
              event.transit.exit, event.transit.walk_minutes)}
          </p>
        )}
        {status !== "open" && (
          <p className="mt-2 text-caption text-warning">
            {translateLib(t, unavailableReason(event, date) ?? "")} {t.spots.notScheduled}
          </p>
        )}

        <details className="mt-3 text-body-sm">
          <summary className="min-h-11 cursor-pointer py-2 text-label underline underline-offset-4">{t.spots.details}</summary>
          {/* 장소 설명·주소·출처명은 데이터 원문 그대로 둔다 (임의 번역 금지). */}
          <dl className="mt-2 space-y-2 text-text-muted">
            <dt className="text-text">{t.spots.doLabel}</dt><dd lang={langOf(event.do_ko)}>{copy.do}</dd>
            <dt className="text-text">{t.spots.getLabel}</dt><dd lang={langOf(event.get_ko)}>{copy.get}</dd>
            <dt className="text-text">{t.spots.closedLabel}</dt><dd>{closedDays}</dd>
            {event.transit && <>
              <dt className="text-text">{t.spots.transitLabel}</dt>
              <dd>{t.spots.transit(
                locale === "ko" ? event.transit.station_ko : event.transit.station_en,
                locale === "ko" ? event.transit.line_ko : event.transit.line_en,
                event.transit.exit, event.transit.walk_minutes)} · {t.spots.source("", event.transit.checked_on)}</dd>
            </>}
            {event.participation && <>
              <dt className="text-text">{t.spots.participationLabel}</dt>
              <dd>
                {locale === "ko" ? event.participation.price_ko : event.participation.price_en}
                {/* 미확인을 "없음"이나 "무료"로 바꾸지 않는다 (이미지·방문 조건 계약). */}
                <br />{event.participation.cash_required === null ? t.spots.cashUnknown : event.participation.cash_required ? t.spots.cashRequired : ""}
                {event.participation.first_come_quantity !== null && <> · {t.spots.firstCome(event.participation.first_come_quantity)}</>}
                {event.participation.lucky_draw && <> · {t.spots.luckyDraw}</>}
              </dd>
            </>}
          </dl>
          {showsEnglishSource && <p className="mt-3 text-caption text-text-muted">{t.spots.englishSource}</p>}
          <p className="mt-3 text-caption text-text-muted">
            {event.from && event.to ? t.spots.period(event.from, event.to) : t.spots.permanent}<br />
            <span lang="en">{event.address}</span><br />
            {t.spots.source(event.provenance.author, event.provenance.checkedOn)}
          </p>
          <a href={event.provenance.url} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-label underline underline-offset-4">
            {t.spots.sourceLink} <ExternalIcon />
          </a>
          <p className="mt-1 text-caption text-text-muted">{t.spots.maps}</p>
          <div className="flex flex-wrap gap-x-4">
            {mapLinks(event.address).map(link => (
              <a key={link.key} href={link.href} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-label underline underline-offset-4">
                {t.spots[link.key]} <ExternalIcon />
              </a>
            ))}
          </div>
        </details>

        <div className="mt-auto">
          {/* 담은 곳만 필수 방문으로 지정할 수 있다. 필수는 방문 수보다 먼저 지켜진다. */}
          {selected && onToggleRequired && <label className="flex min-h-11 cursor-pointer items-center gap-2 text-label">
            <input type="checkbox" checked={required} onChange={onToggleRequired}
              className="size-4 accent-[var(--color-text)]" />
            <span>{t.musts.badge}</span>
            <span className="sr-only">{required ? t.musts.off(copy.title) : t.musts.on(copy.title)}</span>
          </label>}
          <Button className="mt-1" variant="ghost" block onClick={onToggle} disabled={disabled}>
            {selected ? <CheckIcon /> : <PlusIcon />}
            {selected ? t.spots.remove : t.spots.add}
            <span className="sr-only"> {copy.title}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}
