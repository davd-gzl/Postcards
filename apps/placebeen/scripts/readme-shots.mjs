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

const nav = (name) => page.locator(".bottom-nav").getByRole("button", { name, exact: true });
// The "Added …" toast lingers 6s; clear it so it never sits over a screenshot.
const clearToast = async () => {
  const x = page.getByRole("button", { name: "Dismiss" });
  if (await x.count()) await x.click().catch(() => {});
  await page.waitForTimeout(150);
};

// -- Seed a recognisable itinerary across four continents -------------------
async function addPlace(query) {
  await page.getByLabel("Search a city or country").fill(query);
  await page.getByRole("button", { name: new RegExp(query) }).first().click();
  await page.waitForTimeout(180);
}
for (const q of ["Paris", "Lyon", "Marseille", "Bordeaux", "Tokyo", "London", "New York", "Seoul"]) {
  await addPlace(q);
}

// -- Seed a few real journeys so trips draw as great-circle arcs ------------
async function addTrip(fromQ, toQ, mode) {
  await page.getByRole("combobox", { name: "From" }).fill(fromQ);
  await page.locator(".results button").first().click();
  await page.getByRole("combobox", { name: "To" }).fill(toQ);
  await page.locator(".results button").first().click();
  if (mode) await page.locator("#trip-mode").selectOption(mode);
  await page.getByRole("button", { name: "Add trip" }).click();
  await page.waitForTimeout(250);
}
await nav("Trips").click();
await page.waitForTimeout(300);
await addTrip("Paris", "Tokyo", "flight");
await addTrip("London", "New York", "flight");
await addTrip("New York", "Seoul", "flight");
await addTrip("Paris", "Marseille", "train");
await page.waitForTimeout(400);
await clearToast();

// Mobile — the travel log, shown in dark mode to double as a design showcase.
await page.emulateMedia({ colorScheme: "dark" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/trips-mobile.png`, fullPage: true });
await page.emulateMedia({ colorScheme: "light" });
await page.waitForTimeout(400);

// Mobile — frame the whole itinerary neatly, arcs drawn between the cities.
await nav("Map").click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Fit to my places" }).click();
await page.waitForTimeout(3200); // let the fly animation settle
await clearToast();
await page.screenshot({ path: `${OUT}/map-mobile.png`, fullPage: true });

// Mobile — stats (now including airports + travel totals).
await nav("Stats").click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/stats-mobile.png`, fullPage: true });

// Mobile — browsable country checklist.
await nav("Places").click();
await page.getByRole("button", { name: "Countries", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/places-mobile.png`, fullPage: false });

// Desktop hero — full world map with visited places + trip arcs highlighted.
await page.setViewportSize({ width: 1360, height: 900 });
await nav("Map").click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Fit to my places" }).click();
await page.waitForTimeout(2800);
await page.screenshot({ path: `${OUT}/map-desktop.png` });

await browser.close();
console.log("readme screenshots written to", OUT);
