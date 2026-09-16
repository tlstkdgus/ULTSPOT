import { cn } from "@/lib/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-extrabold tracking-[0.01em] text-text", className)}>
      ULT<span className="text-lime">SPOT</span>
    </span>
  );
}
