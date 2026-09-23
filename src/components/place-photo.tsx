"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/locale";
import type { PlacePhoto } from "@/lib/recommend/photo";
import { cn } from "@/lib/cn";

/**
 * 장소 사진 한 장과 출처 (T-051).
 *
 * - **자르지 않는다(object-contain).** 공공누리 제3유형은 변경 금지이고 잘라내기도 변경이다. 유형마다
 *   다르게 그리면 실수하기 쉬워서 모든 사진을 같은 방식으로 보여준다.
 * - 출처를 사진 바로 아래에 둔다. Google 사진은 촬영자와 "Google Maps" 표기가 필수다.
 * - next/image를 쓰지 않는다. 외부 사진을 우리 서버가 받아 변환·캐시하게 되는데, Google 사진은 저장이
 *   금지이고 관광공사 사진은 변환하지 않는 편이 조건에 맞다. 브라우저가 원본 주소에서 직접 받는다.
 * - 불러오지 못하면 사진 칸을 통째로 숨긴다. 깨진 이미지 아이콘을 남기지 않는다.
 */
export function PlacePhotoView({ photo, alt, size = "card", className }: {
  photo: PlacePhoto;
  alt: string;
  size?: "card" | "thumb";
  className?: string;
}) {
  const { t } = useI18n();
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const credit = photo.provider === "google"
    ? t.photo.google(photo.authors.map(a => a.name).filter(Boolean).join(", "))
    : t.photo.tour(photo.license === "kogl-3");
  return (
    // 넓은 화면에서 카드 폭을 다 쓰면 사진 한 장이 화면 절반을 차지한다(1440 캡처에서 확인). 폭을 묶는다.
    <figure className={cn(size === "thumb" ? "w-28 shrink-0" : "w-full sm:max-w-sm", className)}>
      <div className={cn("aspect-[3/2] w-full overflow-hidden rounded-lg bg-surface-2")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 외부 원본을 그대로 건다(위 설명) */}
        <img src={photo.url} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setBroken(true)} className="h-full w-full object-contain" />
      </div>
      <figcaption className="mt-1 text-caption text-text-faint">
        {photo.provider === "google" && photo.authors[0]?.uri
          ? <a href={photo.authors[0].uri} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{credit}</a>
          : credit}
      </figcaption>
    </figure>
  );
}
