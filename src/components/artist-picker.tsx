"use client";
import { useState } from "react";
import { CheckIcon, ExternalIcon, PlusIcon } from "@/components/icons";
import { useI18n } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { artists, searchArtists } from "@/lib/trip/artists";

const MAX = 5;

export function ArtistPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const results = searchArtists(query);
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
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);

  return (
    <fieldset className="mt-6">
      <legend className="text-subhead">{t.artists.legend} <span className="text-label text-text-muted">· {t.artists.optional}</span></legend>
      <p className="mt-2 text-body-sm text-text-muted">{t.artists.hint}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" aria-pressed={!selected.length} onClick={() => onChange([])}
          className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label transition-colors",
            !selected.length ? "border-text bg-surface-2 text-text" : "border-line-strong text-text-muted hover:text-text")}>
          {!selected.length ? <CheckIcon /> : null}{t.artists.all}
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

      {results.length > 0 && (
        <ul aria-label={t.artists.results} className="mt-3 grid gap-2">
          {results.map(artist => {
            const picked = selected.includes(artist.id);
            const parent = artist.parentId ? artists.find(a => a.id === artist.parentId) : undefined;
            const kind = parent ? t.artists.member(locale === "ko" ? parent.korean : parent.name) : t.artists.group;
            return (
              <li key={artist.id} className="flex min-w-0 items-center gap-1 rounded-lg border border-line-strong bg-surface pr-1">
                <button type="button" aria-pressed={picked} disabled={!picked && selected.length >= MAX} onClick={() => toggle(artist.id)}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-4 text-left disabled:opacity-50">
                  <span aria-hidden="true" className={cn("text-body", picked ? "text-text" : "text-text-faint")}>
                    {picked ? <CheckIcon /> : <PlusIcon />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-label">{label(artist.id)}</span>
                    <span className="block truncate text-caption text-text-muted">{secondary(artist.id)} · {kind}</span>
                  </span>
                </button>
                <a href={artist.source} target="_blank" rel="noopener noreferrer"
                  aria-label={t.artists.profile(artist.name)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text">
                  <ExternalIcon />
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {!results.length && <p role="status" className="mt-3 text-body-sm text-text-muted">{t.artists.none}</p>}
      <p className="mt-3 text-caption text-text-muted">{t.artists.scope}</p>
    </fieldset>
  );
}
