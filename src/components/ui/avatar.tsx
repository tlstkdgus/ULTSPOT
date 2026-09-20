import { cn } from "@/lib/cn";

/**
 * 이니셜 아바타. 기준 목업의 `.bias-avatar`(원, surface-2 바탕, 2px 라인, 디스플레이 글꼴)다.
 *
 * 목업이 "사진 대신 이니셜"로 그린 이유가 데이터 상황과도 맞는다 — 승인된 아티스트
 * 사진이 0건이다. 초상을 임의로 가져다 쓰지 않는다.
 *
 * `label`은 스크린리더용 이름(아티스트 표기 그대로)이고, 보이는 글자는 `initials`다.
 */
export function Avatar({ initials, label, size = "md", className }: {
  initials: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface-2",
        "font-display font-bold text-text-muted",
        size === "sm" ? "size-9 text-caption" : "size-12 text-subhead",
        className,
      )}
    >
      {initials}
    </span>
  );
}
