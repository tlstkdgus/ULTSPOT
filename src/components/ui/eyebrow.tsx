import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Eyebrow({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2.5 font-sans text-eyebrow text-lime uppercase", className)}
      {...props}
    >
      {/* 라임을 하드코딩(#d6ff3f22)하고 있었다. 색의 원천은 theme.css 하나여야 한다(AGENTS.md 5).
          같은 모양을 토큰 기반 ring으로 낸다. */}
      <span aria-hidden className="size-1.75 rounded-full bg-lime ring-4 ring-lime/15" />
      {children}
    </div>
  );
}
