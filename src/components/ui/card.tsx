import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * 모든 카드는 Surface 위 1px 라인만 쓰고 그림자는 쓰지 않는다 (가이드 Card Surface).
 * 다크 UI에서 그림자는 거의 보이지 않고, 라인이 더 또렷하게 분리된다.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // 기준 목업의 카드는 반경 18px·여백 20px다(`.spot-card`, `.qcard`).
  // 토큰으로 radius-lg(18px)·p-5(20px)가 정확히 그 값이라 임의값 없이 맞출 수 있다.
  return <div className={cn("rounded-lg border border-line bg-surface p-5", className)} {...props} />;
}
