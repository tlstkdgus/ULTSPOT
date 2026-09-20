import { DotField } from "@/components/brand";
import { HomeIntro } from "@/components/home-intro";
import { dotPalette } from "@/design-system/tokens";

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* 기준 목업의 입자는 작고 선명하다. 반지름 26px·불투명도 0.5까지 갔던 이전 값은
          라임과 오렌지가 배경색에 섞여 얼룩처럼 보였고, 큰 원이 제목 위를 지나며 글자를 가렸다.
          작고 또렷하게 줄여 브랜드 모티프로 읽히게 하고, 본문 뒤로 물러나도록 위쪽에 모은다. */}
      <DotField
        colors={dotPalette.hero}
        count={44}
        radius={[1.5, 4.5]}
        alpha={[0.12, 0.45]}
        seed={11}
        className="absolute inset-x-0 top-0 h-[62vh] [mask-image:linear-gradient(180deg,transparent_0,transparent_5.5rem,#000_8rem,#000_30%,transparent)]"
      />
      {/* 마스크가 위 5.5rem을 비우는 이유: 입자 하나가 언어 선택 바로 아래에 떨어져
          컨트롤에 붙은 점처럼 보였다. 시드를 바꾸면 다른 자리로 옮겨갈 뿐이라,
          헤더 높이만큼은 어떤 시드에서도 입자가 안 깔리게 한다. */}
      <HomeIntro />
    </main>
  );
}
