"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export type DotFieldProps = {
  colors: readonly string[];
  count?: number;
  radius?: [min: number, max: number];
  alpha?: [min: number, max: number];
  /** 같은 seed면 같은 배치가 나온다. 스크린샷 비교가 흔들리지 않도록 랜덤 대신 고정 seed를 쓴다. */
  seed?: number;
  className?: string;
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "스팟" 도트 모티프. 배경 텍스처·빈 상태·공유 카드 프레임에 쓴다. */
export function DotField({
  colors,
  count = 60,
  radius = [2, 26],
  alpha = [0.1, 0.5],
  seed = 7,
  className,
}: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rMin, rMax] = radius;
  const [aMin, aMax] = alpha;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // 좌표를 0~1 비율로 저장해 리사이즈해도 배치가 유지되게 한다.
    const rnd = mulberry32(seed);
    const dots = Array.from({ length: count }, () => ({
      x: rnd(),
      y: rnd(),
      r: rMin + rnd() * (rMax - rMin),
      c: colors[Math.floor(rnd() * colors.length)],
      a: aMin + rnd() * (aMax - aMin),
    }));

    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, width * dpr);
      canvas.height = Math.max(1, height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (const d of dots) {
        ctx.globalAlpha = d.a;
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.arc(d.x * width, d.y * height, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
    // colors는 dotPalette 같은 모듈 상수를 넘긴다고 가정한다. 인라인 배열을 넘기면 렌더마다 다시 그린다.
  }, [colors, count, rMin, rMax, aMin, aMax, seed]);

  return <canvas ref={canvasRef} aria-hidden className={cn("pointer-events-none block size-full", className)} />;
}
