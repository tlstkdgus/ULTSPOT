"use client";
import { useState } from "react";
import { CheckIcon, ExternalIcon, PlusIcon } from "@/components/icons";
import { intlLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { directoryCopy } from "@/i18n/artist-directory";
import { artists, searchArtists } from "@/lib/trip/artists";

const MAX = 5;

type Filter = 'all' | 'group' | 'member' | 'solo' | 'unit';
const byFilter = (filter: Filter) => (a: (typeof artists)[number]) =>
  filter === 'all' || (filter === 'group' ? a.kind === 'group' : filter === 'unit' ? a.kind === 'unit' : filter === 'member' ? a.kind === 'person' && !!a.parentId : a.kind === 'person' && !a.parentId);

/**
 * 첫 화면은 그룹만 그린다 (defaultFilter). 228명을 처음부터 다 그리면 본문 하나로 DOM 5천 개·
 * HTML 562KB가 되어 모바일 첫 로딩이 main의 14배가 됐고, 서버가 막 뜬 직후의 E2E가 60초를 넘겼다.
 * 전체 목록은 "전체" 필터나 둘러보기 모달로 한 번에 간다 — 닿는 길을 줄인 게 아니라 첫 그림을 줄였다.
 *
 * 검색어가 있으면 필터를 무시하고 전체에서 찾는다. "필릭스"를 치고 그룹 필터라서 안 나오면
 * 검색이 고장 난 것처럼 보인다. 검색 중에는 필터 칩도 숨겨 상태가 어긋나 보이지 않게 한다.
 */
export function ArtistPicker({ selected, onChange, defaultFilter = 'group' }: {
  selected: string[]; onChange: (ids: string[]) => void; defaultFilter?: Filter;
}) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const copy = directoryCopy[locale];
  const searching = query.trim().length > 0;
  const results = searching ? searchArtists(query) : artists.filter(byFilter(filter));
  // 이름은 번역하지 않는다. 데이터에 있는 공식 표기(name/korean)만 언어에 따라 앞뒤로 놓는다.
  const label = (id: string) => {
    const artist = artists.find(a => a.id === id);
    if (!artist) return id;
    return locale === "ko" ? artist.korean || artist.name : artist.name;
  };
  const secondary = (id: string) => {
    const artist = artists.find(a => a.id === id);
    if (!artist) return "";
    return locale === "ko" ? artist.name : artist.korean;
  };
  // 데이터에는 월-일만 있다(생년 미수집). 화면 언어에 맞춰 표기만 바꾼다.
  const birthdayLabel = (mmdd: string) => {
    const [month, day] = mmdd.split("-").map(Number);
    return new Intl.DateTimeFormat(intlLocale[locale], { month: "long", day: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(2026, month - 1, day)));
  };
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);

  return (
    <fieldset className="mt-3">
      <legend className="sr-only">{t.artists.legend}</legend>
      <p className="text-body-sm text-text-muted">{t.artists.hint}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!selected.length} onClick={() => onChange([])}
          className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label transition-colors",
            !selected.length ? "border-text bg-surface-2 text-text" : "border-line-strong text-text-muted hover:text-text")}>
          {copy.reset}
        </button>
        {selected.map(id => (
          <button key={id} type="button" onClick={() => toggle(id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-text bg-surface px-4 text-label">
            <span className="sr-only">{t.artists.remove} </span>{label(id)}
            <span aria-hidden="true" className="text-text-muted">×</span>
          </button>
        ))}
      </div>

      <label className="mt-4 block text-label">{t.artists.search}
        <input className="mt-2 block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-4 py-3 text-body"
          placeholder={t.artists.placeholder} value={query} onChange={event => setQuery(event.target.value)} />
      </label>

      {!searching && <nav aria-label={copy.title} className="mt-4 flex flex-wrap gap-2">
        {(['all', 'group', 'member', 'solo', 'unit'] as const).map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={cn("min-h-11 rounded-full border px-4 text-label", filter === key ? "border-text bg-surface-2 text-text" : "border-line-strong text-text-muted")}>{copy[key]}</button>)}
      </nav>}
      <p className="mt-3 text-caption text-text-muted" role="status">{copy.title} · {results.length}</p>
      {results.length > 0 && (
        <ul aria-label={t.artists.results} className="mt-3 grid max-h-screen gap-2 overflow-y-auto">
          {results.map(artist => {
            const picked = selected.includes(artist.id);
            const parent = artist.parentId ? artists.find(a => a.id === artist.parentId) : undefined;
            const kind = parent ? t.artists.member(locale === "ko" ? parent.korean : parent.name) : artist.kind === "group" ? copy.group : artist.kind === "unit" ? copy.unit : copy.solo;
            return (
              <li key={artist.id} className="flex min-w-0 items-center gap-1 rounded-lg border border-line-strong bg-surface pr-1">
                <button type="button" aria-pressed={picked} disabled={!picked && selected.length >= MAX} onClick={() => toggle(artist.id)}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-4 text-left disabled:opacity-50">
                  <span aria-hidden="true" className={cn("text-body", picked ? "text-text" : "text-text-faint")}>
                    {picked ? <CheckIcon /> : <PlusIcon />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-label">{label(artist.id)}</span>
                    <span className="block truncate text-caption text-text-muted">
                      {secondary(artist.id)} · {kind}{artist.collected ? ` · ${copy.collected}` : ""}
                      {artist.birthday_mm_dd && ` · ${t.artists.birthday(birthdayLabel(artist.birthday_mm_dd))}`}
                    </span>
                  </span>
                </button>
                <a href={artist.source} target="_blank" rel="noopener noreferrer"
                  aria-label={t.artists.profile(label(artist.id))}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text">
                  <ExternalIcon />
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {!results.length && <p role="status" className="mt-3 text-body-sm text-text-muted">{t.artists.none}</p>}
    </fieldset>
  );
}
