import type { SVGAttributes } from "react";

/** 지도 핀 = 확대된 도트. 라임 바탕에 잉크색 홀을 뚫는다 (가이드 03 · The Spot Motif). */
export function SpotPin({ size = 34, ...props }: SVGAttributes<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden {...props}>
      <path
        d="M17 3C11 3 6.5 7.6 6.5 13.3 6.5 20.5 17 31 17 31S27.5 20.5 27.5 13.3C27.5 7.6 23 3 17 3Z"
        className="fill-lime"
      />
      <circle cx="17" cy="13" r="5.2" className="fill-ink-900" />
    </svg>
  );
}
