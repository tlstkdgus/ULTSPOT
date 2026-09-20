import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  /** 앞에 붙는 색 점. 필터 칩에서 카테고리 색을 보여줄 때 사용 */
  dotColor?: string;
};

export function Chip({ selected = false, dotColor, className, children, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        // h-9(36px)는 44px 최소 터치 영역에 못 미쳤다. Button의 sm이 같은 이유로 h-11이 됐는데(T-020)
        // 칩만 남아 있었다. 글자 크기는 그대로 두고 상자만 키운다.
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-label font-medium transition-colors duration-150",
        selected
          ? "border-transparent bg-lime font-bold text-lime-ink"
          : "border-line-strong text-text-muted hover:border-ink-400 hover:text-text",
        className,
      )}
      {...props}
    >
      {dotColor ? (
        <span aria-hidden className="size-2.25 rounded-full" style={{ backgroundColor: dotColor }} />
      ) : null}
      {children}
    </button>
  );
}
