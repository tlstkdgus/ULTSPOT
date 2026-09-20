"use client";

import { Button } from '@/components/ui';
import { useI18n } from '@/i18n/locale';
import { calendarSummary } from '@/i18n/journey-calendar';
import { journeyCalendar } from '@/lib/trip/journey-calendar';
import type { Journey } from '@/lib/trip/journey';
import type { DataLocale } from '@/lib/trip/event-copy';
import type { TravelMode, TravelTable } from '@/lib/trip/travel';


export function JourneyCalendarButton({ journey, table, mode, dataLocale, pending, notice }: {
  journey: Journey; table: TravelTable; mode: TravelMode; dataLocale: DataLocale;
  pending: boolean; notice: (message: string) => void;
}) {
  const { t, locale } = useI18n();
  const result = journeyCalendar(journey, table, mode, dataLocale, t.file.calendarNote);
  function download() {
    const url = URL.createObjectURL(new Blob([result.content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ultspot-${journey.startDate}-${journey.endDate}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice(t.result.calendarDone);
  }
  return <div className="mt-5 border-t border-line-strong pt-4">
    <Button disabled={pending || !result.count} onClick={download}>{t.result.calendar}</Button>
    <p className="mt-2 text-caption text-text-muted" aria-live="polite">{pending ? t.travel.lookingUp : calendarSummary[locale](result.count, result.excluded)}</p>
  </div>;
}
