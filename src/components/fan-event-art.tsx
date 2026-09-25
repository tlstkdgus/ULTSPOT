import type { Locale } from '@/i18n/config';

const labels = { ko: '일러스트', en: 'Illustration', ja: 'イラスト', zh: '插画' };

/**
 * Original decorative artwork, not the organizer's poster or a venue photograph.
 * `motif`: 생일카페는 컵, 생일 광고(T-070)는 광고 화면. 광고에 컵을 그리면 카페로 오해한다.
 */
export function FanEventArt({ title, date, variant, locale, motif = 'cup' }: { title: string; date: string; variant: number; locale: Locale; motif?: 'cup' | 'screen' }) {
  const orange = variant % 2 === 0;
  return <div className={`relative isolate aspect-[4/3] overflow-hidden border-b border-line-strong p-5 ${orange ? 'bg-orange text-orange-ink' : 'bg-lime text-lime-ink'}`}>
    <svg viewBox="0 0 400 300" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
      <circle cx="295" cy="110" r="115" fill="currentColor" opacity=".08" />
      <circle cx="35" cy="290" r="125" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25" />
      {motif === 'screen'
        // 역 안 디지털 광고판: 화면 + 하트 + 받침. 날짜·제목이 놓이는 왼쪽 아래를 비워 둔다.
        ? <g transform="translate(250 78) rotate(-6) scale(.78)" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="0" y="0" width="150" height="96" rx="10" fill="currentColor" fillOpacity=".06" />
          <path d="M75 70c-26-16-34-30-24-40 7-7 18-4 24 5 6-9 17-12 24-5 10 10 2 24-24 40Z" fill="currentColor" />
          <path d="M55 96v22M95 96v22M38 118h74M-14 20h-12M-12 48h-16M164 30h14M166 60h12" />
        </g>
        : <g transform={orange ? 'translate(220 55) rotate(12)' : 'translate(235 65) rotate(-12)'} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 55h100v68a30 30 0 0 1-30 30H30a30 30 0 0 1-30-30Z" fill="currentColor" fillOpacity=".06" />
          <path d="M100 70h15c35 0 35 50 0 50h-15M-10 167h135M25 30c-18-18 18-20 0-38M65 30c-18-18 18-20 0-38" />
          <path d="m40 90 10-10 10 10-10 16Z" fill="currentColor" />
        </g>}
      <path d="m55 50 5 14 14 5-14 5-5 14-5-14-14-5 14-5Z M180 190l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="currentColor" />
    </svg>
    <div className="relative flex h-full flex-col justify-between gap-6">
      <div className="flex justify-between gap-2 text-caption font-bold"><span>ULTSPOT</span><span className="rounded-full border border-current px-2 py-1">{labels[locale]}</span></div>
      <div className="max-w-[75%]"><p className="mb-2 text-label">{date}</p><p className="text-heading leading-tight">{title.split(' · ')[0]}</p></div>
    </div>
  </div>;
}
