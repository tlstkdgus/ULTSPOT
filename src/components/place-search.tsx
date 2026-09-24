"use client";

import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui";
import { ExternalIcon, PinIcon } from "@/components/icons";
import { useI18n } from "@/i18n/locale";
import type { PlaceSearchResult } from "@/lib/trip/place-search";

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "done"; results: PlaceSearchResult[] }
  | { status: "notConfigured" }
  | { status: "failed" };

/**
 * 장소 이름으로 찾아 고르기 (T-062). 카카오 키워드 검색을 서버(/api/place-search)로 부른다.
 *
 * 폼 안에 두지 않는다 — 검색창에서 Enter를 누르면 행사 추가 폼이 제출되기 때문이다. 고른 결과는 onPick으로 넘기고,
 * 좌표·주소를 채우는 일은 부르는 쪽이 한다. 검색은 선택이다. 고르지 않아도 주소를 직접 적어 추가할 수 있다.
 */
export function PlaceSearch({ picked, onPick, onClear }: {
  picked: PlaceSearchResult | null;
  onPick: (result: PlaceSearchResult) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setState({ status: "searching" });
    try {
      const response = await fetch("/api/place-search", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }),
      });
      const body = await response.json() as { configured?: boolean; results?: PlaceSearchResult[]; failed?: boolean; budgetExhausted?: boolean };
      if (!response.ok || body.failed || body.budgetExhausted) setState({ status: "failed" });
      else if (body.configured === false) setState({ status: "notConfigured" });
      else setState({ status: "done", results: body.results ?? [] });
    } catch {
      setState({ status: "failed" });
    }
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); void search(); }
  };

  if (picked) {
    return <div className="mt-5 rounded-lg border border-line-strong bg-bg-soft p-4 text-body-sm">
      <p className="flex items-center gap-2 text-label"><PinIcon />{t.placeSearch.picked(picked.name)}</p>
      <p className="mt-1 text-caption text-text-muted">{picked.address}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a href={picked.placeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
          {t.placeSearch.open} <ExternalIcon />
        </a>
        <Button size="sm" variant="ghost" onClick={onClear}>{t.placeSearch.clear}</Button>
      </div>
    </div>;
  }

  return <div className="mt-5">
    <label className="block text-label" htmlFor="place-search">{t.placeSearch.label}</label>
    <div className="mt-2 flex gap-2">
      <input id="place-search" type="search" value={query} maxLength={60} placeholder={t.placeSearch.placeholder}
        onChange={event => setQuery(event.target.value)} onKeyDown={onKey}
        className="block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-3 py-3 text-body" />
      <Button type="button" variant="ghost" onClick={() => void search()} disabled={query.trim().length < 2 || state.status === "searching"}>
        {t.placeSearch.search}
      </Button>
    </div>
    <p className="mt-2 text-caption text-text-muted">{t.placeSearch.hint}</p>
    <div role="status" className="mt-2 text-body-sm">
      {state.status === "searching" && <span className="text-text-muted">{t.placeSearch.searching}</span>}
      {state.status === "notConfigured" && <span className="text-warning">{t.placeSearch.notConfigured}</span>}
      {state.status === "failed" && <span className="text-warning">{t.placeSearch.failed}</span>}
      {state.status === "done" && !state.results.length && <span className="text-text-muted">{t.placeSearch.none}</span>}
    </div>
    {state.status === "done" && state.results.length > 0 && <ul className="mt-2 divide-y divide-line rounded-lg border border-line-strong">
      {state.results.map(result => <li key={result.id}>
        <button type="button" onClick={() => onPick(result)} aria-label={t.placeSearch.pick(result.name)}
          className="flex min-h-11 w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-surface">
          <span className="text-label">{result.name}</span>
          <span className="text-caption text-text-muted">{[result.category.split(" > ").at(-1), result.address].filter(Boolean).join(" · ")}</span>
        </button>
      </li>)}
    </ul>}
  </div>;
}
