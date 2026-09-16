import { cn } from "@/lib/cn";

export type AvatarStackProps = {
  /** 표시할 아바타 수. 이미지가 생기기 전까지는 그라디언트 원으로 대체한다. */
  count: number;
  max?: number;
  className?: string;
  label?: string;
};

/**
 * 라임→오렌지 그라디언트는 "같은 이벤트에 관심 있는 팬" 표시 전용으로 예약돼 있다 (가이드 Avatar Stack).
 * 다른 컴포넌트에서 이 그라디언트를 재사용하지 않는다.
 */
export function AvatarStack({ count, max = 3, className, label }: AvatarStackProps) {
  const shown = Math.min(count, max);
  const rest = count - shown;

  return (
    <div className={cn("flex items-center", className)} aria-label={label ?? `관심 있는 팬 ${count}명`} role="img">
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="-ml-2 size-6.5 rounded-full border-2 border-bg-soft bg-linear-135 from-lime to-orange first:ml-0"
        />
      ))}
      {rest > 0 ? <span className="ml-1.5 text-caption text-text-faint">+{rest}</span> : null}
    </div>
  );
}
