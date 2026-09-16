import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// theme.css에 추가한 커스텀 스케일을 알려주지 않으면
// tailwind-merge가 `text-caption`을 색상 클래스로 오인해 `text-lime`과 충돌시킨다.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["hero", "display", "title", "heading", "subhead", "body", "body-sm", "label", "caption", "eyebrow"],
      radius: ["xs", "sm", "md", "lg", "xl", "device"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
