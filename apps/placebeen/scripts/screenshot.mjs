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

// Tap the first city row to reveal its population; wish it if not visited.
await page.locator(".city-row .city-focus").first().click();
await page.waitForTimeout(600);
const wishBtn = page.getByRole("button", { name: /Wish to go/ });
if (await wishBtn.count()) await wishBtn.first().click();
await page.waitForTimeout(300);
// Favorite a visited city: search Tokyo, select its row via search-add already visited?
// Simpler: mark the currently selected city's Favorite if present.
const favBtn = page.getByRole("button", { name: /Favorite/ }).first();
if (await favBtn.count()) await favBtn.click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/placebeen-mobile-map-selected.png`, fullPage: true });

await page.getByRole("button", { name: "Stats", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/placebeen-mobile-stats.png`, fullPage: true });

await page.getByRole("button", { name: "Places", exact: true }).click();
await page.getByRole("tab", { name: "Countries" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/placebeen-mobile-countries.png`, fullPage: false });

// Desktop look.
await page.setViewportSize({ width: 1180, height: 820 });
await page.getByRole("button", { name: "Map", exact: true }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/placebeen-desktop-map.png` });

await browser.close();
console.log("screenshots written to", OUT);
