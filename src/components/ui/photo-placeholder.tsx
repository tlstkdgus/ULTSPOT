import { CameraIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * 승인된 사진이 없는 자리. 기준 목업의 `.spot-photo`(96px, 135° 그라디언트, 흐린 가운데 글자)다.
 *
 * **이 자리를 장식 그래픽으로 채우지 않는다.** 그럴듯한 이미지를 넣으면 실제 매장·행사
 * 사진으로 읽히고, 승인된 아티스트·장소 이미지는 아직 0건이다. 비어 있다는 사실을
 * 글자로 말하는 것이 이 컴포넌트의 목적이다. AI 생성 이미지도 같은 이유로 쓰지 않는다.
 *
 * `label`은 화면 언어를 따르는 문구를 호출부에서 넘긴다(`t.spots.photoPending`).
 */
export function PhotoPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-24 flex-col items-center justify-center gap-1 border-b border-line-strong",
        "bg-linear-135 from-ink-600 to-ink-800 text-text-faint",
        className,
      )}
    >
      <CameraIcon className="text-subhead" />
      <span className="text-caption">{label}</span>
    </div>
  );
}
