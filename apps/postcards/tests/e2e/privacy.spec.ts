import { test, expect } from "@playwright/test";

// SC-006 / Constitution III: zero outbound requests leave the origin during
// normal use. Everything — app, gazetteer, map geometry — is served locally.
test("no network request leaves the local origin during core flows", async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL!) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      external.push(url);
    }
  });

  await page.goto("/");
  await expect(page.getByText("Cities in view")).toBeVisible();

  // Exercise every core flow: add, map, stats, places, export surface.
  await page.getByLabel("Search a city or country").fill("Rome");
  await page.getByRole("button", { name: /Rome/ }).first().click();
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.getByText("Statistics")).toBeVisible();
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByText("Your data")).toBeVisible();
  await page.waitForTimeout(1000); // let any stray beacons fire

  expect(external, `external requests: ${external.join(", ")}`).toEqual([]);
});
