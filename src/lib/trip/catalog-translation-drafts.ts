import type { FanEvent } from './planner';

// AI-authored drafts only. Never merged into the public catalog before language review.
export const catalogTranslationDrafts: Record<string, Partial<FanEvent>> = {
  'hikr-ground': {
    title_ja: 'HiKR Ground・K-pop体験スペース', area_ja: '中区',
    title_zh: 'HiKR Ground・K-pop体验空间', area_zh: '中区',
  },
  'music-korea': {
    title_ja: 'Music Korea・明洞2号店', area_ja: '中区',
    title_zh: 'Music Korea・明洞2号店', area_zh: '中区',
  },
  'k-star-road': {
    title_ja: 'K-Star Road', area_ja: '江南区',
    title_zh: 'K-Star Road', area_zh: '江南区',
  },
};
for (const draft of Object.values(catalogTranslationDrafts)) {
  draft.translation_review = {};
  for (const locale of ['ja', 'zh'] as const) {
    draft.translation_review[locale] = {};
    for (const field of ['title', 'area'] as const) {
      draft.translation_review[locale]![field] = {
        author: 'Codex (AI translation; no native-language review)',
        source: 'src/lib/trip/catalog.ts', status: 'draft',
      };
    }
  }
}
