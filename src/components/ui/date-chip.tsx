import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type DateChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  weekday: string;
  day: number | string;
  active?: boolean;
};

export function DateChip({ weekday, day, active = false, className, type = "button", ...props }: DateChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        "flex min-w-11 shrink-0 flex-col items-center rounded-sm border px-2.5 py-2 text-[0.6875rem] transition-colors duration-150",
        active
          ? "border-lime bg-lime text-lime-ink"
          : "border-line-strong bg-surface-2 text-text-muted hover:border-ink-400",
        className,
      )}
      {...props}
    >
      {weekday}
      <span className={cn("mt-0.5 font-display text-sm font-bold", active ? "text-lime-ink" : "text-text")}>
        {day}
      </span>
    </button>
  );
}
