import { test, expect } from "@playwright/test";
import { gotoTab } from "./nav-helper";

// SC-006 / Constitution III: no personal data and no third-party trackers ever
// leave the device. The detailed OpenStreetMap map is on by default, so anonymous
// map-tile fetches to tile.openstreetmap.org are expected and allowed (they carry
// no personal data, and a Settings switch turns them off for a fully offline app).
// EVERY other outbound request — telemetry, analytics, fonts, anything — is a
// violation. App, gazetteer and map geometry are all served locally.
const ALLOWED_HOSTS = ["tile.openstreetmap.org"];

test("only OpenStreetMap tiles leave the origin during core flows", async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith(baseURL!) || url.startsWith("data:") || url.startsWith("blob:")) return;
    try {
      if (ALLOWED_HOSTS.includes(new URL(url).hostname)) return;
    } catch {
      /* unparseable url — treat as external below */
    }
    external.push(url);
  });

  await page.goto("/");
  await expect(page.getByText("Cities in view")).toBeVisible();

  // Exercise every core flow: add, map, stats, places, export surface.
  await page.getByLabel("Search a city or country").fill("Rome");
  await page.getByRole("button", { name: "Mark Rome visited" }).first().click();
  await page.keyboard.press("Escape");
  await gotoTab(page, "Stats");
  await expect(page.getByText("Statistics")).toBeVisible();
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Places" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Your data")).toBeVisible(); // export surface lives here now
  await page.waitForTimeout(1000); // let any stray beacons fire

  expect(external, `external requests: ${external.join(", ")}`).toEqual([]);
});
