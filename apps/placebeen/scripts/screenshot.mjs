import { chromium } from "@playwright/test";

const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.OUT_DIR || "/tmp";
const BASE = "http://localhost:4173/";

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.goto(BASE);

async function add(query, nameRe) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Search a city or country").fill(query);
  await page.getByRole("button", { name: new RegExp(nameRe) }).first().click();
  await page.getByRole("button", { name: /Add visit/ }).click();
}

for (const [q, n] of [
  ["Paris", "Paris"],
  ["Lyon", "Lyon"],
  ["Marseille", "Marseille"],
  ["Bordeaux", "Bordeaux"],
  ["Tokyo", "Tokyo"],
  ["London", "London"],
  ["New York", "New York"],
  ["Seoul", "Seoul"],
]) {
  await add(q, n);
}

await page.getByRole("button", { name: "Stats", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/placebeen-stats.png`, fullPage: true });

await page.getByRole("button", { name: "Map", exact: true }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/placebeen-map.png` });

await browser.close();
console.log("screenshots written to", OUT);
