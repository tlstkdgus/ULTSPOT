import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Eyebrow({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2.5 font-sans text-eyebrow text-lime uppercase", className)}
      {...props}
    >
      <span aria-hidden className="size-1.75 rounded-full bg-lime shadow-[0_0_0_4px_#d6ff3f22]" />
      {children}
    </div>
  );
}
