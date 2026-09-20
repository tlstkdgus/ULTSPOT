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

export function KakaoMap({ points, className }: { points: { name: string; coord: Coord }[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!KEY || !ref.current || points.length === 0) return;
    const el = ref.current;
    const draw = () => {
      const maps = window.kakao?.maps;
      if (!maps) { setFailed(true); return; }
      maps.load(() => {
        const bounds = new maps.LatLngBounds();
        const map = new maps.Map(el, { center: new maps.LatLng(points[0].coord.lat, points[0].coord.lng), level: 6 });
        points.forEach((p, i) => {
          const pos = new maps.LatLng(p.coord.lat, p.coord.lng);
          new maps.Marker({ map, position: pos });
          new maps.CustomOverlay({ map, position: pos, yAnchor: 2.6,
            content: `<div style="background:#d6ff3f;color:#1d2400;font:700 12px/1 sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap">${i + 1}. ${p.name.replace(/</g, "&lt;")}</div>` });
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
  }, [points]);

  if (!KEY || failed || points.length === 0) return null;
  return <div ref={ref} aria-hidden="true" className={className} />;
}
