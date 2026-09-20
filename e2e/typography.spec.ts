import { expect, test } from "@playwright/test";
/**
 * 한국어 조판 규칙이 전역에 걸려 있던 탓에, 일본어 한 문단이 서체 4종(Malgun Gothic·
 * Noto Sans KR·Yu Gothic·Pretendard)으로 그려지고 중국어 제목에는 브랜드 글꼴이 하나도
 * 남지 않은 적이 있다. 한자가 한국어 자형으로 나오는 것은 눈으로 훑어서는 잘 안 보인다.
 *
 * 규칙은 @layer 밖에 있어야 한다. Tailwind의 font-sans가 utilities 레이어라
 * @layer base에 적으면 명시도와 무관하게 진다 — 일본어 주 버튼만 한국어 글꼴로 그려졌다.
 */
for (const loc of ["ko", "en", "ja", "zh"] as const) {
  test(`글꼴 혼용 ${loc}`, async ({ page, context, baseURL }) => {
    test.slow();
    await context.addCookies([{ name: "ultspot-locale", value: loc, url: baseURL! }]);
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    const mixed: string[] = []; const seen = new Set<string>();
    for (const route of ["/", "/plan"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      await page.evaluate(async () => { await document.fonts.ready; });
      const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
      const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "h1,h2,h3,p,button,span,dd,label,summary" });
      for (const nodeId of nodeIds) {
        let fonts; try { ({ fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId })); } catch { continue; }
        const base = (n: string) => n.replace(/\s+(Variable|Medium|Bold|Light|Regular|Semibold|UI)$/i, "");
        const fams = [...new Set(fonts.filter(f => f.glyphCount > 1).map(f => base(f.familyName)))];
        fams.forEach(f => seen.add(f));
        const real = fams.filter(f => f !== "Unbounded");
        if (real.length > 1) {
          const txt = (await cdp.send("DOM.getOuterHTML", { nodeId })).outerHTML.replace(/<[^>]*>/g, "").trim().slice(0, 28);
          // 아티스트·장소 이름은 번역하지 않으므로 일본어·중국어 화면에도 한글이 그대로 나온다
          // ("스트레이 키즈 · 团体"). 문자체계가 진짜로 둘이면 글꼴이 갈리는 것이 맞다.
          // 잡아야 하는 것은 같은 문자체계가 두 글꼴로 쪼개지는 경우다.
          const hasHangul = /[가-힣]/.test(txt);
          if (loc === "ko" || loc === "en" || !hasHangul) mixed.push(`${loc}${route} "${txt}" -> ${real.join(" + ")}`);
        }
      }
    }
    expect([...seen], `${loc}: 브랜드 글꼴이 안 그려졌다 — 측정 무효`).toContain("Pretendard");
    expect(mixed, "한 요소 안에서 글꼴 어족이 섞였다").toEqual([]);
  });
}
