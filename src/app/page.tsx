import { DotField } from "@/components/brand";
import { HomeIntro } from "@/components/home-intro";
import { dotPalette } from "@/design-system/tokens";

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <DotField
        colors={dotPalette.hero}
        count={46}
        radius={[2, 26]}
        alpha={[0.1, 0.5]}
        seed={11}
        className="absolute inset-0 opacity-55"
      />
      <HomeIntro />
    </main>
  );
}
