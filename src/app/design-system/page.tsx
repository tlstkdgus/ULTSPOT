import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DotField, DotLoader, SpotPin, Wordmark } from "@/components/brand";
import { AvatarStack, Badge, Button, Card, Chip, DateChip, Eyebrow } from "@/components/ui";
import { color, dotPalette } from "@/design-system/tokens";

export const metadata: Metadata = {
  title: "Design System",
  robots: { index: false, follow: false },
};

const brandSwatches = [
  { name: "Neon Lime", hex: color.lime, token: "lime", use: "Primary. CTA, 활성 상태, 핵심 데이터(날짜·매칭 결과)" },
  { name: "Sunset Orange", hex: color.orange, token: "orange", use: "Accent. 뱃지·태그·일러스트 포인트에만 절제해서" },
  { name: "Ink", hex: color.ink900, token: "bg / ink-900", use: "Background. 형광 컬러 발색을 극대화" },
  { name: "Surface", hex: color.ink700, token: "surface / ink-700", use: "카드·시트 등 배경 위에 뜨는 표면" },
  { name: "Cream Text", hex: color.ink100, token: "text / ink-100", use: "본문 텍스트. 순백 대신 따뜻한 톤" },
];

const neutralScale = [
  ["900", color.ink900, "text-ink-400"],
  ["800", color.ink800, "text-ink-400"],
  ["700", color.ink700, "text-ink-400"],
  ["600", color.ink600, "text-ink-300"],
  ["500", color.ink500, "text-ink-300"],
  ["400", color.ink400, "text-ink-900"],
  ["300", color.ink300, "text-ink-900"],
  ["100", color.ink100, "text-ink-900"],
] as const;

const statusSwatches = [
  { label: "Success / 진행중", hex: color.success },
  { label: "Warning / 마감임박", hex: color.warning },
  { label: "Danger / 마감", hex: color.danger },
];

const typeScale = [
  { token: "text-hero", spec: "Unbounded 900 · clamp 52–132", sample: "FIND YOUR SPOT.", className: "text-hero font-display" },
  { token: "text-display", spec: "Unbounded 900 · clamp 40–56", sample: "SPOT IT", className: "text-display font-display" },
  { token: "text-heading", spec: "Unbounded 800 · clamp 22–34", sample: "덕질 일정, 한 화면에", className: "text-heading font-display" },
  { token: "text-subhead", spec: "Pretendard 700 · 20", sample: "부제목 한 줄이 여기 들어갑니다", className: "text-subhead" },
  {
    token: "text-body",
    spec: "Pretendard 400 · 16",
    sample: "본문은 이 크기로 들어갑니다. 실제 문구가 아니라 크기를 보기 위한 견본입니다.",
    className: "text-body text-text-muted",
  },
  { token: "text-caption", spec: "Pretendard 500 · 12.5 · upper", sample: "CAPTION · SPECIMEN", className: "text-caption uppercase text-text-faint" },
];

function Section({ id, eyebrow, title, description, children }: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-b border-line py-14 last:border-b-0 md:py-16">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow className="mb-4.5">{eyebrow}</Eyebrow>
          <h2 className="text-title">{title}</h2>
        </div>
        {description ? <p className="max-w-[42ch] text-body-sm text-text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="shell">
      <header className="flex items-center justify-between py-5.5 text-[0.8125rem] text-text-faint">
        <Wordmark className="text-base" />
        <span>Design System · v1.0</span>
      </header>

      <Section
        id="color"
        eyebrow="01 · Color"
        title="두 개의 형광, 하나의 잉크"
        description="경쟁 서비스의 핑크·레드·블루와 겹치지 않도록 네온 라임과 선셋 오렌지를 브랜드 축으로 삼았습니다. Tailwind 기본 팔레트는 비활성화되어 있습니다."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 md:gap-4">
          {brandSwatches.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className="h-20 md:h-28" style={{ backgroundColor: s.hex }} />
              <div className="p-3.5 md:p-4">
                <div className="text-label">{s.name}</div>
                <div className="mt-1 font-mono text-caption text-text-faint">{s.hex.toUpperCase()}</div>
                <div className="mt-1 font-mono text-badge text-lime-dim">{s.token}</div>
                <p className="mt-2 hidden text-caption font-normal tracking-normal text-text-muted sm:block">{s.use}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex overflow-hidden rounded-md border border-line">
          {neutralScale.map(([step, hex, text]) => (
            <div key={step} className={`flex h-14 flex-1 items-end px-2 pb-2 font-mono text-badge ${text}`} style={{ backgroundColor: hex }}>
              {step}
            </div>
          ))}
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {statusSwatches.map((s) => (
            <div key={s.label} className="rounded-md border border-line bg-surface px-4.5 py-4">
              <div className="mb-3 size-5.5 rounded-xs" style={{ backgroundColor: s.hex }} />
              <div className="text-label">{s.label}</div>
              <div className="mt-1 font-mono text-[0.71875rem] text-text-faint">{s.hex.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="type"
        eyebrow="02 · Typography"
        title="Unbounded × Pretendard"
        description="브랜드 모먼트는 Unbounded, 실제 UI·본문은 Pretendard Variable. 큰 제목은 clamp로 뷰포트에 맞춰 커집니다."
      >
        <div className="divide-y divide-line border-y border-line">
          {typeScale.map((t) => (
            <div key={t.token} className="flex flex-col gap-2 py-5 md:flex-row md:items-baseline md:gap-6">
              <div className="w-48 shrink-0 font-mono text-xs text-text-faint">
                <div className="text-lime-dim">{t.token}</div>
                <div>{t.spec}</div>
              </div>
              <div className={`min-w-0 break-keep ${t.className}`}>{t.sample}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="motif"
        eyebrow="03 · The Spot Motif"
        title="땡땡이는 지도 위의 점"
        description="흩뿌린 도트를 지도 핀 / 로딩 / 빈 상태 / 배경 텍스처에 재사용합니다. seed를 고정해 매번 같은 배치가 나옵니다."
      >
        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-64 overflow-hidden rounded-xl border border-line bg-surface md:min-h-72">
            <DotField
              colors={dotPalette.motif}
              count={70}
              radius={[3, 22]}
              alpha={[0.35, 1]}
              seed={42}
              className="absolute inset-0"
            />
          </div>
          <Card className="flex flex-col justify-center gap-4.5 p-7">
            <SpotPin />
            <h3 className="text-subhead font-display">핀(Pin) = 확대된 도트</h3>
            <p className="text-body-sm text-text-muted">
              라임 바탕에 잉크색 홀을 뚫어 브랜드 컬러를 유지한 채 &ldquo;장소&rdquo;라는 기능을 표현합니다.
            </p>
            <div className="flex items-center gap-3 text-caption text-text-faint">
              <DotLoader /> DotLoader
            </div>
          </Card>
        </div>
      </Section>

      <Section
        id="components"
        eyebrow="04 · Components"
        title="실제 화면에 올려보면"
        description="src/components/ui · src/components/brand 에 있는 컴포넌트를 그대로 조합한 예시입니다."
      >
        <div className="grid items-start gap-10 lg:grid-cols-[auto_1fr]">
          <div className="mx-auto w-full max-w-80 overflow-hidden rounded-device border-8 border-black bg-bg-soft shadow-[0_30px_60px_-20px_#000000aa]">
            <div className="px-4 pt-5">
              {/* 여기 글자는 전부 자리표시다. 실제 장소 이름처럼 보이는 값을 두면
                  공개 경로라 심사자가 실제 목록으로 오해한다. 화면에도 그 사실을 적는다. */}
              <div className="mb-4.5 flex justify-between text-badge text-text-faint">
                <span>ULTSPOT</span>
                <span>견본 · 실제 데이터 아님</span>
              </div>
              <div className="font-display text-title leading-tight font-extrabold">
                제목이
                <br />
                <em className="text-lime not-italic">두 줄</em>로 들어갑니다
              </div>
              <p className="mt-1.5 mb-4 text-caption text-text-muted">보조 설명 한 줄이 여기 붙습니다</p>

              <div className="mb-4.5 flex gap-2 overflow-x-auto pb-1">
                <DateChip weekday="MON" day={14} />
                <DateChip weekday="TUE" day={15} active />
                <DateChip weekday="WED" day={16} />
                <DateChip weekday="THU" day={17} />
                <DateChip weekday="FRI" day={18} />
              </div>

              <Card className="relative mb-3.5">
                <Badge tone="ongoing" className="absolute top-3.5 right-3.5">진행중</Badge>
                <AvatarStack count={3} className="mb-2.5" />
                <h4 className="mb-1 font-display text-body font-bold">스팟 이름이 들어갑니다</h4>
                <p className="text-caption text-text-muted">
                  지역 · <b className="font-bold text-lime">운영 기간</b> · 도보 시간
                </p>
              </Card>
              <Card className="relative">
                <Badge tone="closing" className="absolute top-3.5 right-3.5">마감임박</Badge>
                <AvatarStack count={2} className="mb-2.5" />
                <h4 className="mb-1 font-display text-body font-bold">두 번째 스팟 이름</h4>
                <p className="text-caption text-text-muted">
                  지역 · <b className="font-bold text-lime">운영 기간</b> · 도보 시간
                </p>
              </Card>

              <div className="my-4 flex gap-2">
                <Button block>스팟 저장하기</Button>
                <Button variant="ghost" block>지도 보기</Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <div className="mb-3 text-caption font-bold text-lime uppercase">Button</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="lg">Primary lg</Button>
                <Button>Primary md</Button>
                <Button size="sm">Primary sm</Button>
                <Button variant="ghost">Ghost</Button>
                <Button disabled>Disabled</Button>
              </div>
              <p className="mt-3 text-body-sm text-text-muted">라임 버튼은 화면당 핵심 액션 하나에만 씁니다.</p>
            </Card>
            <Card className="p-5">
              <div className="mb-3 text-caption font-bold text-lime uppercase">Badge</div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="ongoing">진행중</Badge>
                <Badge tone="closing">마감임박</Badge>
                <Badge tone="closed">마감</Badge>
                <Badge tone="accent">NEW</Badge>
                <Badge>일반</Badge>
              </div>
              <p className="mt-3 text-body-sm text-text-muted">상태 뱃지는 의미 색만, 오렌지는 상태가 아닌 태그에만.</p>
            </Card>
            <Card className="p-5">
              <div className="mb-3 text-caption font-bold text-lime uppercase">Chip</div>
              <div className="flex flex-wrap gap-2">
                <Chip selected>스트레이 키즈</Chip>
                <Chip>생일카페</Chip>
                <Chip>팝업</Chip>
                <Chip dotColor={color.orange}>굿즈</Chip>
              </div>
            </Card>
          </div>
        </div>
      </Section>

      <Section id="usage" eyebrow="05 · Usage" title="Do & Don't">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-positive-line bg-positive-surface p-5.5">
            <span className="mb-3 block font-display text-[0.8125rem] font-extrabold text-lime">DO</span>
            <ul className="list-disc space-y-1.5 pl-4.5 text-body-sm text-text-muted">
              <li>라임은 화면당 핵심 액션 1곳에만 — CTA, 활성 탭, 매칭 결과 숫자</li>
              <li>오렌지는 뱃지·태그처럼 작은 면적의 보조 강조로만</li>
              <li>배경은 항상 Ink 계열 다크 톤 유지</li>
              <li>도트 모티프는 지도·로딩·빈 상태 등 위치/탐색 맥락에서</li>
            </ul>
          </div>
          <div className="rounded-lg border border-negative-line bg-negative-surface p-5.5">
            <span className="mb-3 block font-display text-[0.8125rem] font-extrabold text-danger">DON&apos;T</span>
            <ul className="list-disc space-y-1.5 pl-4.5 text-body-sm text-text-muted">
              <li>라임과 오렌지를 같은 요소에 동시에 칠하지 않기</li>
              <li>밝은 배경 위에 라임을 그대로 쓰지 않기 — 대비가 무너짐</li>
              <li>상태 뱃지에 브랜드 컬러 쓰지 않기</li>
              <li>핫핑크·레드·블루를 강조색으로 끌어오지 않기</li>
            </ul>
          </div>
        </div>
      </Section>

      <footer className="flex flex-wrap justify-between gap-2.5 py-10 text-xs text-text-faint">
        <span>ULTSPOT — AI 덕질 여행 플래너</span>
        <span>Brand &amp; Design Guide v1.0 · Neon Lime × Sunset Orange</span>
      </footer>
    </div>
  );
}
