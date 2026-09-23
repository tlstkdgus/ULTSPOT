"use client";

import { useEffect, useRef, useState } from "react";
import type { Coord } from "@/lib/trip/geo";

/**
 * 카카오 지도. 정류장 핀과 번호만 찍는다 — 직선을 경로처럼 그리지 않는다.
 *
 * 키는 `NEXT_PUBLIC_KAKAO_JS_KEY`(카카오 앱의 JavaScript 키)다. REST 키와 다르다.
 * JavaScript 키는 카카오 콘솔에서 허용 도메인으로 묶이는 브라우저용 키라 노출이 설계상 전제다.
 * 키가 없으면 아무것도 그리지 않고 호출부가 기존 핀 목록·카카오맵 링크를 그대로 보여준다.
 */
declare global {
  interface Window { kakao?: { maps: KakaoMaps } }
}
type KakaoMaps = {
  load: (cb: () => void) => void;
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => { extend: (p: unknown) => void };
  Map: new (el: HTMLElement, opts: { center: unknown; level: number }) => { setBounds: (b: unknown) => void };
  Marker: new (opts: { map: unknown; position: unknown }) => unknown;
  CustomOverlay: new (opts: { map: unknown; position: unknown; content: string; yAnchor: number }) => unknown;
};

const KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export function KakaoMap({ points, className }: { points: { name: string; coord: Coord; tentative?: boolean }[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  /**
   * 배열은 렌더마다 새로 만들어진다. 예전에는 [points]에 걸려 화면이 조금만 바뀌어도 지도를 새로 만들었다.
   * 빈 시간 추천(T-049)이 하나씩 채워질 때마다 지도가 다시 그려져 T-052에서 내용 기준으로 바꿨다.
   */
  const pointsKey = JSON.stringify(points);

  useEffect(() => {
    const points = JSON.parse(pointsKey) as { name: string; coord: Coord; tentative?: boolean }[];
    if (!KEY || !ref.current || points.length === 0) return;
    const el = ref.current;
    const draw = () => {
      const maps = window.kakao?.maps;
      if (!maps) { setFailed(true); return; }
      maps.load(() => {
        const bounds = new maps.LatLngBounds();
        const map = new maps.Map(el, { center: new maps.LatLng(points[0].coord.lat, points[0].coord.lng), level: 6 });
        const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        let confirmed = 0;
        points.forEach(p => {
          const pos = new maps.LatLng(p.coord.lat, p.coord.lng);
          new maps.Marker({ map, position: pos });
          // 확정 정류장은 번호와 라임, 빈 시간 추천은 번호 없이 주황. 화면 목록과 같은 구분이다.
          const [bg, ink] = p.tentative ? [token("--color-orange"), token("--color-orange-ink")] : [token("--color-lime"), token("--color-lime-ink")];
          const label = `${p.tentative ? "" : `${++confirmed}. `}${p.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}`;
          new maps.CustomOverlay({ map, position: pos, yAnchor: 2.6,
            content: `<div style="background:${bg};color:${ink};font:700 12px/1 sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap">${label}</div>` });
          bounds.extend(pos);
        });
        if (points.length > 1) map.setBounds(bounds);
      });
    };
    if (window.kakao?.maps) { draw(); return; }
    const id = "kakao-maps-sdk";
    if (document.getElementById(id)) { document.getElementById(id)!.addEventListener("load", draw); return; }
    const script = document.createElement("script");
    script.id = id;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`;
    script.async = true;
    script.onload = draw;
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
  }, [pointsKey]);

  if (!KEY || failed || points.length === 0) return null;
  return <div ref={ref} aria-hidden="true" className={className} />;
}
