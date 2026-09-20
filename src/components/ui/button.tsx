import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  // 라임은 화면당 핵심 액션 1곳에만 — 가이드 Do 규칙
  primary: "bg-lime text-lime-ink hover:bg-lime-dim",
  ghost: "border border-line-strong text-text hover:bg-surface-2",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-11 px-3.5 text-label",
  md: "h-12 px-4 text-label",
  lg: "h-14 px-6 text-subhead",
};

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
};

/** next/link 등 button이 아닌 요소에 같은 모양을 입힐 때 사용 */
export function buttonStyles({ variant = "primary", size = "md", block, className }: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-sans font-bold whitespace-nowrap",
    "transition-colors duration-150 ease-out-soft disabled:pointer-events-none",
    // 1단계의 주 버튼은 장소를 고르기 전까지 비활성이 "기본" 상태다. 투명도 40%로 흐리면
    // 라임 위 잉크가 3.4:1까지 떨어져 고장난 버튼으로 읽혔다. 별도 색이면 7.3:1로 "아직"이 된다.
    "disabled:bg-surface-2 disabled:text-text-muted disabled:border-line-strong",
    variantClass[variant],
    sizeClass[size],
    block && "w-full",
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Omit<ButtonStyleOptions, "className">;

export function Button({ variant, size, block, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, block, className })} {...props} />;
}
