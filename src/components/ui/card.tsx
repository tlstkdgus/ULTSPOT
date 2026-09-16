import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * 모든 카드는 Surface 위 1px 라인만 쓰고 그림자는 쓰지 않는다 (가이드 Card Surface).
 * 다크 UI에서 그림자는 거의 보이지 않고, 라인이 더 또렷하게 분리된다.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface p-4", className)} {...props} />;
}
