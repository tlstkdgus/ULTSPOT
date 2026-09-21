"use client";

import { useRef, useState } from "react";
import { directoryCopy } from "@/i18n/artist-directory";
import { Button } from "@/components/ui";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { ArtistPicker } from "@/components/artist-picker";
import { useI18n } from "@/i18n/locale";
import { artists } from "@/lib/trip/artists";
import { cn } from "@/lib/cn";

/**
 * 첫 단계: 최애 고르기. 고르면 바로 스팟 탐색으로 넘어간다 (테마 테스트 없음).
 *
 * 최애를 고르지 않아도 진행할 수 있다. 검증된 관련 장소가 아직 적어서, 고르기를 필수로 만들면
 * 빈 목록에 갇힌다. 고르지 않은 상태를 숨기지 않고 "전체를 보여준다"고 적는다.
 *
 * 아티스트 사진은 쓰지 않는다. 사용 허락을 확인한 자산이 없어 이니셜 그래픽으로 대신한다.
 */
export function FavoriteStep({ selected, onChange, onNext }: {
  selected: string[];
  onChange: (ids: string[]) => void;
  onNext: () => void;
}) {
  const { locale, t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  // 모달 안의 목록은 열려 있을 때만 그린다. 닫혀 있어도 228명을 그리면 본문 목록과 합쳐 버튼
  // 481개·HTML 562KB가 첫 화면에 실렸다(main은 버튼 15개·21KB). 모바일 첫 로딩이 가장 무겁다.
  const [dialogOpen, setDialogOpen] = useState(false);
  const copy = directoryCopy[locale];
  const picked = artists.filter(a => selected.includes(a.id));
  const name = (id: string) => {
    const artist = artists.find(a => a.id === id);
    if (!artist) return id;
    return locale === "ko" ? artist.korean || artist.name : artist.name;
  };
  // 이니셜은 표시용 그래픽이다. 한글 이름은 첫 글자, 라틴 이름은 앞 두 글자를 쓴다.
  const initials = (id: string) => {
    const label = name(id).replace(/\s+/g, "");
    return /[가-힣]/.test(label) ? label.slice(0, 1) : label.slice(0, 2).toUpperCase();
  };

  return (
    <section aria-label={t.steps.labels[0]} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <div className="min-w-0 rounded-device border border-line-strong bg-surface p-6 sm:p-8">
        <Button block size="lg" onClick={() => { setDialogOpen(true); dialog.current?.showModal(); }}>{copy.browse} · {artists.length}</Button>
        <dialog ref={dialog} onClose={() => setDialogOpen(false)} aria-label={copy.browse} className="fixed inset-0 m-auto max-h-screen w-full max-w-3xl overflow-y-auto rounded-device border border-line-strong bg-surface p-6 text-text backdrop:bg-bg/80 sm:p-8">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-surface pb-4">
            <h2 className="text-subhead">{copy.browse}</h2>
            <Button onClick={() => dialog.current?.close()}>{copy.done} · {selected.length}/5</Button>
          </div>
          {dialogOpen && <ArtistPicker selected={selected} onChange={onChange} />}
        </dialog>
        <ArtistPicker selected={selected} onChange={onChange} />
      </div>

      <aside className="flex flex-col rounded-device border border-line-strong bg-bg-soft p-6 sm:p-7">
        <p className="text-label text-text-muted">{t.artists.legend}</p>
        {picked.length > 0 ? <>
          <ul className="mt-5 flex flex-wrap gap-3">
            {picked.map(artist => <li key={artist.id} className="flex min-w-0 items-center gap-3">
              {/* 승인된 아티스트 사진이 없어 이니셜 그래픽을 쓴다. 사진이 있는 것처럼 보이지 않게 둔다. */}
              <span aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-2 font-display text-subhead text-text">
                {initials(artist.id)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-label">{name(artist.id)}</span>
                <span className="block truncate text-caption text-text-muted">
                  {artist.parentId ? t.artists.member(name(artist.parentId)) : t.artists.group}
                </span>
              </span>
            </li>)}
          </ul>
          <p className="mt-5 flex items-center gap-2 text-body-sm text-text">
            <CheckIcon />{t.favorite.picked(picked.map(a => name(a.id)).join(" + "))}
          </p>
        </> : (
          <p className="mt-5 text-body-sm text-text-muted">{t.favorite.none}</p>
        )}

        <div className={cn("mt-auto pt-6", picked.length ? "" : "pt-6")}>
          <Button block size="lg" onClick={onNext}>
            {picked.length ? t.favorite.cta : t.favorite.skip} <ArrowRightIcon />
          </Button>
        </div>
      </aside>
    </section>
  );
}
