// Generates the screenshots used in the repo-root README.
// Usage: OUT_DIR=... node scripts/readme-shots.mjs  (preview server must be on :4173)
import { chromium } from "@playwright/test";

const EXEC = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.OUT_DIR || "/tmp";
const BASE = "http://localhost:4173/";

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE);

async function add(query) {
  await page.getByLabel("Search a city or country").fill(query);
  await page.getByRole("button", { name: new RegExp(query) }).first().click();
  await page.waitForTimeout(180);
}

// A varied, recognisable itinerary across four continents.
for (const q of ["Paris", "Lyon", "Marseille", "Bordeaux", "Tokyo", "London", "New York", "Seoul"]) {
  await add(q);
}
await page.waitForTimeout(2200);

// Mobile — frame the whole itinerary neatly. Wait out the "added" toast first.
await page.getByRole("button", { name: "Fit to my places" }).click();
await page.waitForTimeout(5200);
await page.screenshot({ path: `${OUT}/map-mobile.png`, fullPage: true });

// Mobile — stats.
await page.getByRole("button", { name: "Stats", exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/stats-mobile.png`, fullPage: true });

// Mobile — browsable country checklist.
await page.getByRole("button", { name: "Places", exact: true }).click();
await page.getByRole("tab", { name: "Countries" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/places-mobile.png`, fullPage: false });

// Desktop hero — full world map with visited places highlighted.
await page.setViewportSize({ width: 1360, height: 900 });
await page.getByRole("button", { name: "Map", exact: true }).click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Fit to my places" }).click();
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/map-desktop.png` });

await browser.close();
console.log("readme screenshots written to", OUT);
