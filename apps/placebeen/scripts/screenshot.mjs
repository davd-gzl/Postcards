import { chromium } from "@playwright/test";

const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.OUT_DIR || "/tmp";
const BASE = "http://localhost:4173/";

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
// Mobile-first: capture at phone size.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE);

async function add(query) {
  await page.getByLabel("Search a city or country").fill(query);
  await page.getByRole("button", { name: new RegExp(query) }).first().click();
  await page.waitForTimeout(150);
}

for (const q of ["Paris", "Lyon", "Marseille", "Bordeaux", "Tokyo", "London", "New York", "Seoul"]) {
  await add(q);
}
// Let the last fly settle, then zoom out to a wide view so the list matches.
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) {
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.waitForTimeout(250);
}
await page.waitForTimeout(1800);

await page.screenshot({ path: `${OUT}/placebeen-mobile-map.png`, fullPage: true });

await page.getByRole("button", { name: "Stats", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/placebeen-mobile-stats.png`, fullPage: true });

// Desktop look.
await page.setViewportSize({ width: 1180, height: 820 });
await page.getByRole("button", { name: "Map", exact: true }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/placebeen-desktop-map.png` });

await browser.close();
console.log("screenshots written to", OUT);
