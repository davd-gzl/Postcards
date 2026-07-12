import { test, expect } from "@playwright/test";
import { gotoTab } from "./nav-helper";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.1 AA gate (SC-005): no serious/critical axe violations on any screen.
async function assertNoSeriousViolations(page: import("@playwright/test").Page, screen: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    serious,
    `${screen}: ${serious.map((v) => `${v.id} (${v.nodes.length} nodes)`).join(", ")}`,
  ).toEqual([]);
}

test("map, stats and places screens pass the axe WCAG 2.1 AA gate", async ({ page }) => {
  await page.goto("/");

  // Seed one visit so lists/bars render (the row's chip is the explicit add).
  await page.getByLabel("Search a city or country").fill("Lisbon");
  await page.getByRole("button", { name: "Mark Lisbon visited" }).first().click();
  await page.keyboard.press("Escape");

  await expect(page.getByText("Cities in view")).toBeVisible();
  await assertNoSeriousViolations(page, "map");

  await gotoTab(page, "Stats");
  await expect(page.getByText("Statistics")).toBeVisible();
  await assertNoSeriousViolations(page, "stats");

  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Places" })).toBeVisible();
  await assertNoSeriousViolations(page, "places");

  await page.getByRole("button", { name: "Passport", exact: true }).click();
  await expect(page.getByText("flags collected")).toBeVisible();
  await assertNoSeriousViolations(page, "passport");

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Your data")).toBeVisible();
  await assertNoSeriousViolations(page, "settings");
});
