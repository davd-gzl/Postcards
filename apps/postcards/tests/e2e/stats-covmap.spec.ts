import { test, expect, type Page } from "@playwright/test";
import { gotoTab } from "./nav-helper";
import AxeBuilder from "@axe-core/playwright";

async function assertNoSeriousViolations(page: Page, screen: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(serious, `${screen}: ${serious.map((v) => v.id).join(", ")}`).toEqual([]);
}

// Expanding a country card in Stats shows a STATIC coverage map (not the old text
// lists): the country silhouette with visited-city dots and "still to explore"
// region blobs. It's a role=img with a descriptive label, so it passes the a11y gate.
test("a country card shows a static coverage map that passes the a11y gate", async ({
  page,
}: {
  page: Page;
}) => {
  await page.goto("/");
  for (const c of ["Paris", "Lyon", "Marseille"]) {
    await page.getByLabel("Search a city or country").fill(c);
    await page.getByRole("button", { name: `Mark ${c} visited` }).first().click();
    await page.keyboard.press("Escape");
  }
  await gotoTab(page, "Stats");
  await page.locator(".country-summary", { hasText: "France" }).click();

  const map = page.locator(".country-card", { hasText: "France" }).locator(".country-cov-map svg");
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute("role", "img");
  // The silhouette + at least one visited dot rendered.
  await expect(map.locator("path.ccov-land")).toHaveCount(1);
  expect(await map.locator("circle.ccov-visited").count()).toBeGreaterThan(0);

  await assertNoSeriousViolations(page, "stats country coverage map");
});
