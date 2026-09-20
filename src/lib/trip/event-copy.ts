import type { FanEvent } from './planner';

export type DataLocale = 'ko' | 'en' | 'ja' | 'zh';
type CopyField = 'title' | 'area' | 'do' | 'get';

/** Personal text is untouched. Draft translations fall back directly to English. */
export function eventCopy(event: FanEvent, locale: DataLocale) {
  const copy = (field: CopyField): string => {
    if (event.provenance.mode !== 'reviewed' || locale === 'en') return event[field];
    if ((locale === 'ja' || locale === 'zh') && event.translation_review?.[locale]?.[field]?.status === 'draft') return event[field];
    const translated = event[(field + '_' + locale) as 'title_ko' | 'area_ko' | 'do_ko' | 'get_ko' | 'title_ja' | 'area_ja' | 'do_ja' | 'get_ja' | 'title_zh' | 'area_zh' | 'do_zh' | 'get_zh'];
    return translated?.trim() ? translated : event[field];
  };
  return { title: copy('title'), area: copy('area'), do: copy('do'), get: copy('get') };
}
