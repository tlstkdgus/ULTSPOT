import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * ongoing / closing / closed 는 이벤트 상태 전용이며 의미 색만 쓴다.
 * accent(오렌지)는 상태가 아닌 태그·라벨용이다.
 * 가이드 목업의 "Ongoing" 뱃지는 오렌지로 그려져 있지만,
 * 같은 가이드의 Don't("상태 뱃지에 브랜드 컬러 대신 의미 색상")와 충돌해 규칙 쪽을 따랐다.
 */
export type BadgeTone = "ongoing" | "closing" | "closed" | "accent" | "category" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  ongoing: "bg-success text-ink-900",
  closing: "bg-warning text-orange-ink",
  closed: "bg-danger text-ink-900",
  accent: "bg-orange text-orange-ink",
  // 기준 목업의 `.spot-tag` — 카드 위 분류 라벨(생일카페·팝업 등)에 쓰는 라임 알약.
  // 운영 상태가 아니므로 위의 의미 색과 섞이지 않게 이름을 따로 뒀다.
  category: "bg-lime font-bold text-lime-ink",
  neutral: "bg-surface-2 text-text-muted",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-badge",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
