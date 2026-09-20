import type { SVGProps } from "react";

/**
 * 플래너용 선 아이콘. 한 가지 굵기(1.75)·24 그리드로 통일한다.
 * 이전에 쓰던 유니코드 기호(✦ ◎ ↗ ♡)는 글꼴마다 모양이 달라서 대체했다.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

export const CameraIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Icon>;
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Icon>;
/** 언어 선택 옆. 한국어 화면에 처음 닿은 사람에게 "한국어"라는 글자만으로는 그게 언어 컨트롤인지 알 수 없다. */
export const GlobeIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.3-3.4-8.5s1.2-6.2 3.4-8.5z" /></Icon>;
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const ArrowRightIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ArrowLeftIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
export const ArrowDownIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Icon>;
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const ExternalIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" /></Icon>;
export const CalendarIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></Icon>;
export const PinIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></Icon>;
export const TrainIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><rect x="6" y="3" width="12" height="13" rx="3" /><path d="M6 10h12M9 20l-2 2M15 20l2 2M8.5 16h.01M15.5 16h.01M9 16h6" /></Icon>;
export const ClockIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 2" /></Icon>;
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const SlowIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M4 16c3-6 13-6 16 0" /><path d="M8 16h8" /></Icon>;
export const FastIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M4 12h9M4 7h13M4 17h6M16 12l4 0" /><path d="m17 9 3 3-3 3" /></Icon>;
