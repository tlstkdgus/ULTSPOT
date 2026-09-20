"use client";

import { Badge, Button, type BadgeTone } from "@/components/ui";
import { CameraIcon, CheckIcon, ClockIcon, ExternalIcon, PinIcon, PlusIcon } from "@/components/icons";
import { useI18n } from "@/i18n/locale";
import { translateLib } from "@/i18n/messages";
import { cn } from "@/lib/cn";
import { clock, unavailableReason, type FanEvent } from "@/lib/trip/planner";

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

export function SpotCard({ event, date, selected, disabled, onToggle }: {
  event: FanEvent; date: string; selected: boolean; disabled: boolean; onToggle: () => void;
}) {
  const { locale, t } = useI18n();
  const status = spotStatus(event, date);
  const personal = event.provenance.mode === "personal";
  const kind = (locale === "ko" && t.kinds[event.kind]) || event.kind;
  const closedDays = event.closedDays.length
    ? event.closedDays.map(day => t.spots.weekdays[day]).join(", ")
    : t.spots.openEveryDay;
  const hours = event.opens !== null && event.closes !== null ? t.spots.hours(clock(event.opens), clock(event.closes)) : t.spots.hoursUnknown;

  return (
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors",
      selected ? "border-text" : "border-line-strong")}>
      {/* 승인된 사진이 없으면 그 사실을 적는다. 장식 기호로 사진 자리를 채우지 않는다. */}
      <div className="flex h-24 flex-col items-center justify-center gap-1 border-b border-line-strong bg-surface-2 text-text-muted">
        <CameraIcon className="text-subhead" />
        <span className="text-caption">{t.spots.photoPending}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone[status]}>{t.status[status]}</Badge>
          {personal && <Badge tone="accent">{t.status.personal}</Badge>}
          {selected && <span className="inline-flex items-center gap-1 text-caption text-text"><CheckIcon />{t.spots.added}</span>}
        </div>
        <h3 className="mt-3 text-subhead" lang="en">{event.title}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5"><ClockIcon />{hours}</span>
          {event.lastEntry !== undefined && <span>{t.spots.lastEntry(clock(event.lastEntry))}</span>}
          <span className="inline-flex items-center gap-1.5"><PinIcon /><span lang="en">{event.area}</span> · {kind}</span>
        </p>
        {status !== "open" && (
          <p className="mt-2 text-caption text-warning">
            {translateLib(t, unavailableReason(event, date) ?? "")} {t.spots.notScheduled}
          </p>
        )}

        <details className="mt-3 text-body-sm">
          <summary className="min-h-11 cursor-pointer py-2 text-label underline underline-offset-4">{t.spots.details}</summary>
          {/* 장소 설명·주소·출처명은 데이터 원문 그대로 둔다 (임의 번역 금지). */}
          <dl className="mt-2 space-y-2 text-text-muted">
            <dt className="text-text">{t.spots.doLabel}</dt><dd lang="en">{event.do}</dd>
            <dt className="text-text">{t.spots.getLabel}</dt><dd lang="en">{event.get}</dd>
            <dt className="text-text">{t.spots.closedLabel}</dt><dd>{closedDays}</dd>
          </dl>
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

        <Button className="mt-auto" variant="ghost" onClick={onToggle} disabled={disabled}>
          {selected ? <CheckIcon /> : <PlusIcon />}
          {selected ? t.spots.remove : t.spots.add}
          <span className="sr-only"> {event.title}</span>
        </Button>
      </div>
    </article>
  );
}
