import type { FanEvent } from './planner';

/** Presentation copy only: never mutate the catalog, saved draft or scheduling inputs. */
export function eventCopy(event: FanEvent, locale: 'ko' | 'en') {
  const ko = locale === 'ko' && event.provenance.mode === 'reviewed';
  return {
    title: ko ? event.title_ko || event.title : event.title,
    area: ko ? event.area_ko || event.area : event.area,
    do: ko ? event.do_ko || event.do : event.do,
    get: ko ? event.get_ko || event.get : event.get,
  };
}
