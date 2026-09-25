import { expect, test } from "@playwright/test";
import { messages } from "../src/i18n/messages";

/**
 * 개인정보 처리방침 (T-058). 모든 화면 하단 푸터에서 열리고, 언어를 바꾸면 푸터와 본문이 같이 바뀐다.
 * 기본 언어는 한국어다(playwright locale ko-KR).
 */
for (const path of ["/", "/plan", "/design-system"]) {
  test(`the footer on ${path} links to the privacy notice`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("© 2026 ULTSPOT");
    await footer.getByRole("link", { name: "개인정보 처리방침" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeVisible();
  });
}

test("the notice lists every section and follows a language switch", async ({ page }) => {
  await page.goto("/privacy");
  for (const section of messages.ko.privacy.sections)
    await expect(page.getByRole("heading", { level: 2, name: section.heading })).toBeVisible();
  // 적힌 내용이 실제 구현과 맞는지 핵심 사실 몇 가지를 고정한다.
  await expect(page.getByText("ultspot-locale", { exact: false })).toBeVisible();
  await expect(page.getByText("최근 2일", { exact: false })).toBeVisible();

  await page.getByLabel("언어").selectOption("ja");
  await expect(page.getByRole("heading", { level: 1, name: messages.ja.privacy.title })).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: messages.ja.privacy.footer })).toBeVisible();
});

test("the notice gives a contact address for questions and deletion requests", async ({ page }) => {
  // T-069: T-058에서 비워 둔 문의처. 사용자가 공개를 정한 주소다.
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 2, name: messages.ko.privacy.contact.heading })).toBeVisible();
  await expect(page.getByRole("link", { name: "a91945840@gmail.com" })).toHaveAttribute("href", "mailto:a91945840@gmail.com");
});
