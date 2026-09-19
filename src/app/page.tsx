import Link from "next/link";
import { DotField, Wordmark } from "@/components/brand";
import { buttonStyles } from "@/components/ui";
import { dotPalette } from "@/design-system/tokens";

export default function HomePage() {
  return (
    <main lang="en" className="relative flex min-h-dvh flex-col overflow-hidden">
      <DotField
        colors={dotPalette.hero}
        count={46}
        radius={[2, 26]}
        alpha={[0.1, 0.5]}
        seed={11}
        className="absolute inset-0 opacity-55"
      />

      <header className="relative shell flex items-center justify-between py-5.5">
        <Wordmark className="text-base" />
        <span className="text-caption text-text-muted">No login needed</span>
      </header>

      <section className="relative shell flex flex-1 flex-col justify-center pb-16">
        <h1 className="text-hero text-text">
          FIND
          <br />
          YOUR <em className="text-lime not-italic">SPOT</em>.
        </h1>
        <p className="mt-7 max-w-[34ch] text-body text-text-muted md:text-subhead md:font-normal">
          Birthday cafés, fan moments, and a day that fits. Build your K-pop itinerary with <b className="font-bold text-text">ULTSPOT</b>.
        </p>
        <div className="mt-9 flex flex-col gap-2 sm:flex-row">
          <Link href="/plan" className={buttonStyles({ size: "lg" })}>
            Plan my trip →
          </Link>
        </div>
        <p className="mt-4 text-body-sm text-text-muted">Real places. Your own event notices. A plan you can keep.<br />No signup or payment required.</p>
      </section>
    </main>
  );
}
