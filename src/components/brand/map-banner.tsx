import { DotField } from "@/components/brand/dot-field";
import { SpotPin } from "@/components/brand/spot-pin";
import { Wordmark } from "@/components/brand/wordmark";
import { dotPalette } from "@/design-system/tokens";
import { cn } from "@/lib/cn";

/**
 * 홈 지도 배너. 기준 목업의 "서울 곳곳에 스팟이 흩어져 있다"는 첫인상을 옮긴 것이다.
 *
 * 목업에는 지역 이름(홍대·성수·강남·건대)과 핀별 개수(12·7·9·4), "32 VERIFIED SPOTS"가
 * 붙어 있지만 전부 목업이 스스로 예시라고 적은 값이라 넣지 않는다. 검증된 장소는 3곳이고,
 * 그 숫자는 화면 아래 정직 문구가 이미 말한다. 여기서 지역과 개수를 그리면 그 문구와
 * 어긋나는 거짓 정보가 된다.
 *
 * 그래서 이 배너는 지도가 아니라 **브랜드 모티프**다. 격자와 글로우는 장식이고, 핀은
 * 디자인 시스템의 The Spot Motif다. 라벨도 개수도 없으니 특정 장소를 가리키지 않는다.
 * 장식을 실제 사진이나 조회된 지도처럼 보이게 하지 않는다.
 */
export function MapBanner({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-device border border-line-strong bg-bg-soft",
        className,
      )}
    >
      {/* 격자 — 지도의 결만 빌려온 장식. 실제 도로가 아니다. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-line-strong) 1px, transparent 1px), linear-gradient(90deg, var(--color-line-strong) 1px, transparent 1px)",
          backgroundSize: "clamp(56px, 14vw, 104px) clamp(56px, 14vw, 104px)",
          maskImage: "radial-gradient(120% 90% at 50% 45%, #000 45%, transparent 100%)",
        }}
      />
      {/* 브랜드 두 색의 온기. 네온 라임 × 선셋 오렌지. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(42% 58% at 24% 38%, color-mix(in srgb, var(--color-lime) 22%, transparent), transparent 70%)," +
            "radial-gradient(46% 62% at 76% 58%, color-mix(in srgb, var(--color-orange) 20%, transparent), transparent 72%)",
        }}
      />
      <DotField
        colors={dotPalette.hero}
        count={54}
        radius={[1.5, 5]}
        alpha={[0.25, 0.85]}
        seed={23}
        className="absolute inset-0"
      />

      <div className="relative flex aspect-[16/10] flex-col justify-between p-5 sm:aspect-[2/1] sm:p-7">
        <Wordmark className="text-label sm:text-subhead" />

        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <SpotPin size={30} className="absolute left-[22%] top-[34%] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:left-[24%]" />
          <SpotPin size={22} className="absolute left-[54%] top-[24%] opacity-70" />
          <SpotPin size={26} className="absolute left-[72%] top-[52%] opacity-85" />
        </div>

        <p className="text-eyebrow text-text-faint" lang="en">{label}</p>
      </div>
    </div>
  );
}
