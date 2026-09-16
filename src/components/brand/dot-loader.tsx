import { cn } from "@/lib/cn";

const dotColors = ["bg-lime", "bg-orange", "bg-ink-100"] as const;

/** 도트 모티프 로딩 인디케이터. prefers-reduced-motion이면 globals.css에서 애니메이션이 꺼진다. */
export function DotLoader({ className, label = "불러오는 중" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex items-center gap-1.5", className)}>
      {dotColors.map((color, i) => (
        <span
          key={color}
          aria-hidden
          className={cn("size-2.5 animate-dot-pulse rounded-full", color)}
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
