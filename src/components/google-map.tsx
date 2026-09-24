"use client";

import { useEffect, useRef, useState } from "react";
import type { Coord } from "@/lib/trip/geo";

/**
 * Google 지도 (T-052). 정류장·추천 핀만 찍는다 — 직선을 경로처럼 그리지 않는다(카카오 지도와 같은 원칙).
 *
 * 키는 `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY`(Maps JavaScript API 전용, HTTP 리퍼러 제한). 브라우저에 노출되는
 * 것이 전제인 키라 서버용 `GOOGLE_MAPS_API_KEY`(Places)와 **다른 키**로 둔다.
 * 키가 있으면 일정 화면의 지도가 Google이 된다. Google 장소 사진(T-052)은 이 지도가 떠 있을 때만 쓴다
 * (Places 약관: 비구글 지도와 함께 쓰기 금지).
 */
export const GOOGLE_MAPS_JS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;

type LatLngLiteral = { lat: number; lng: number };
type GoogleMaps = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => { fitBounds: (b: unknown, pad?: number) => void; setCenter: (c: LatLngLiteral) => void; setZoom: (z: number) => void };
  LatLngBounds: new () => { extend: (p: LatLngLiteral) => void };
  Marker: new (opts: Record<string, unknown>) => unknown;
  SymbolPath: { CIRCLE: unknown };
};
declare global { interface Window { google?: { maps?: GoogleMaps }; __ultspotGoogleMapsReady?: () => void } }

let loading: Promise<GoogleMaps | null> | null = null;
function loadGoogleMaps(language: string): Promise<GoogleMaps | null> {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = new Promise(resolve => {
    window.__ultspotGoogleMapsReady = () => resolve(window.google?.maps ?? null);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_JS_KEY ?? "")}` +
      `&v=weekly&language=${language}&region=KR&loading=async&callback=__ultspotGoogleMapsReady`;
    script.async = true;
    script.onerror = () => { loading = null; resolve(null); };
    document.head.appendChild(script);
  });
  return loading;
}

/** 테마 토큰 값을 읽는다. 지도 핀 색도 토큰만 쓴다(docs/design-system.md). */
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export type MapPoint = { name: string; coord: Coord; tentative?: boolean };

export function GoogleMap({ points, className, language = "ko", label }: { points: MapPoint[]; className?: string; language?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // 배열은 렌더마다 새로 만들어진다. 내용이 같으면 지도를 다시 그리지 않는다.
  const pointsKey = JSON.stringify(points);

  useEffect(() => {
    const list = JSON.parse(pointsKey) as MapPoint[];
    if (!GOOGLE_MAPS_JS_KEY || !ref.current || !list.length) return;
    const el = ref.current;
    let cancelled = false;
    void loadGoogleMaps(language).then(maps => {
      if (cancelled) return;
      if (!maps) { setFailed(true); return; }
      const map = new maps.Map(el, {
        center: list[0].coord, zoom: 15, clickableIcons: false,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });
      const bounds = new maps.LatLngBounds();
      let confirmedIndex = 0;
      for (const point of list) {
        new maps.Marker({
          map, position: point.coord, title: point.name,
          // 확정 정류장은 번호, 추천은 번호 없이 다른 색. 화면 목록과 같은 구분이다.
          label: point.tentative ? undefined : { text: String(++confirmedIndex), color: token("--color-lime-ink"), fontWeight: "700" },
          icon: {
            path: maps.SymbolPath.CIRCLE, scale: point.tentative ? 8 : 13, fillOpacity: 1, strokeWeight: 2,
            fillColor: token(point.tentative ? "--color-orange" : "--color-lime"), strokeColor: token("--color-ink-900"),
          },
        });
        bounds.extend(point.coord);
      }
      if (list.length > 1) map.fitBounds(bounds, 48);
    });
    return () => { cancelled = true; };
  }, [pointsKey, language]);

  if (!GOOGLE_MAPS_JS_KEY || failed || points.length === 0) return null;
  // 카카오 지도와 달리 확대·축소 버튼이 키보드로 잡힌다. aria-hidden 안에 초점이 들어가면 화면 낭독기가
  // 이름 없는 버튼을 읽는다(WCAG 4.1.2). 숨기지 않고 이름 붙은 영역으로 둔다(T-055).
  return <div ref={ref} role="region" aria-label={label} className={className} />;
}
