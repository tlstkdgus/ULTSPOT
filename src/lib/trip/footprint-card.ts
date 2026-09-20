/**
 * 발자취 공유 카드.
 *
 * 카드에 적는 모든 숫자는 사용자가 직접 표시한 방문에서 센 값이다. 만들지 않는 것:
 *  - **거리(km).** 측정한 이동 거리가 없다. 직선거리 × 보정계수는 이동 거리가 아니고,
 *    카드에 km가 적히면 사용자는 그것을 측정값으로 읽는다.
 *  - **방문 시각.** journey는 날짜만 기록한다. 카드에도 날짜만 쓴다.
 *  - **도트 경로.** 점을 이어 놓으면 동선으로 읽힌다. 좌표가 있는 곳이 일부뿐이라
 *    정규화한 점 그림은 실제 동선과 다르다. 그래서 번호 목록으로만 보여준다.
 *
 * 색은 src/design-system/tokens.ts만 쓴다. canvas는 CSS 변수를 읽을 수 없어서 JS 사본이 필요하다.
 */

import { color } from "@/design-system/tokens";
import type { Footprint } from "./footprint";

/** 소셜 카드 비율. F-10의 1080×1350을 그대로 쓴다. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
const PLACE_LIMIT = 8;

export type FootprintCardText = {
  headline: string;
  stats: string[];
  places: string[];
  /** 목록에 넣지 못한 나머지 수. 0이면 표시하지 않는다. */
  overflow: number;
  note: string;
  wordmark: string;
};

/**
 * 카드에 들어갈 글자를 정한다. 그리기와 분리해 둔 이유는, 카드가 무엇을 주장하는지를
 * 픽셀 없이 검사할 수 있게 하려는 것이다.
 */
export function footprintCardText(footprint: Footprint, copy: {
  places: (n: number) => string;
  visits: (n: number) => string;
  days: (n: number) => string;
  following: (artist: string, n: number) => string;
  spent: (amount: string) => string;
  noDistance: string;
  money: (amountKrw: number) => string;
  /** 고른 최애 이름. 고르지 않았으면 빈 문자열이고, 그때는 최애 문구를 쓰지 않는다. */
  artistNames: string;
}): FootprintCardText {
  const named = copy.artistNames.trim() !== "" && footprint.artistPlaces > 0;
  return {
    headline: named
      ? copy.following(copy.artistNames, footprint.artistPlaces)
      : copy.places(footprint.places),
    stats: [
      copy.places(footprint.places),
      copy.visits(footprint.visits),
      copy.days(footprint.days),
      // 0원은 쓰지 않았다는 뜻이 아니라 기록하지 않았다는 뜻이다. 그래서 0이면 줄을 넣지 않는다.
      ...(footprint.spentKrw > 0 ? [copy.spent(copy.money(footprint.spentKrw))] : []),
    ],
    places: footprint.timeline.slice(0, PLACE_LIMIT).map(item => item.place.title),
    overflow: Math.max(0, footprint.timeline.length - PLACE_LIMIT),
    note: copy.noDistance,
    wordmark: "ULTSPOT",
  };
}

/** 한 줄이 폭을 넘으면 단어 단위로 자른다. 글자를 잘라 버리지 않는다. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else { lines.push(line); line = word; }
  }
  lines.push(line);
  return lines;
}

const display = (size: number, weight: number) =>
  `${weight} ${size}px var(--font-unbounded), Pretendard, system-ui, sans-serif`;
const sans = (size: number, weight: number) =>
  `${weight} ${size}px Pretendard, system-ui, sans-serif`;

/**
 * 카드를 그린다. 캔버스 크기는 호출부가 CARD_WIDTH·CARD_HEIGHT로 맞춰 둔다.
 * 폰트가 아직 로드되지 않았으면 대체 글꼴로 그려지고, 숫자와 글자는 그대로 남는다.
 */
export function drawFootprintCard(ctx: CanvasRenderingContext2D, card: FootprintCardText) {
  const pad = 88;
  const inner = CARD_WIDTH - pad * 2;

  ctx.fillStyle = color.ink900;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  // 라임 테두리 한 줄. 배경 사진이 없어도 카드가 브랜드로 읽히게 하는 최소 장치다.
  ctx.strokeStyle = color.lime;
  ctx.lineWidth = 6;
  ctx.strokeRect(pad / 2, pad / 2, CARD_WIDTH - pad, CARD_HEIGHT - pad);

  ctx.textBaseline = "top";
  ctx.fillStyle = color.lime;
  ctx.font = display(40, 900);
  ctx.fillText(card.wordmark, pad, pad);

  let y = pad + 120;
  ctx.fillStyle = color.ink100;
  ctx.font = display(76, 900);
  for (const line of wrap(ctx, card.headline, inner)) {
    ctx.fillText(line, pad, y);
    y += 92;
  }

  y += 24;
  ctx.font = sans(36, 700);
  for (const stat of card.stats) {
    ctx.fillStyle = color.orange;
    ctx.fillText("—", pad, y);
    ctx.fillStyle = color.ink300;
    ctx.fillText(stat, pad + 56, y);
    y += 56;
  }

  y += 32;
  ctx.font = sans(32, 500);
  card.places.forEach((place, index) => {
    ctx.fillStyle = color.limeDim;
    ctx.fillText(String(index + 1).padStart(2, "0"), pad, y);
    ctx.fillStyle = color.ink100;
    const lines = wrap(ctx, place, inner - 80);
    ctx.fillText(lines[0] ?? "", pad + 72, y);
    y += 52;
  });
  if (card.overflow > 0) {
    ctx.fillStyle = color.ink400;
    ctx.fillText(`+${card.overflow}`, pad + 72, y);
    y += 52;
  }

  // 거리를 적지 않는 이유를 카드 자체가 말한다. 빠진 값이 아니라 정한 값임을 보이려는 것이다.
  ctx.font = sans(26, 500);
  ctx.fillStyle = color.ink400;
  const noteLines = wrap(ctx, card.note, inner);
  let noteY = CARD_HEIGHT - pad - noteLines.length * 36;
  for (const line of noteLines) {
    ctx.fillText(line, pad, noteY);
    noteY += 36;
  }
}
