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
        "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-label font-medium transition-colors duration-150",
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
