// Generate the PWA app icons from an inline SVG (the map-pin brand motif), so
// the installed app has a real icon. Rendered with the bundled Chromium — no
// image dependency. Run: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const INDIGO = "#4338ca";

// A white map pin (teardrop with a hole) on an indigo field.
function svg({ size, radius, pinScale }) {
  const c = size / 2;
  const s = size / 512;
  const p = (n) => (n * s * pinScale + c * (1 - pinScale)).toFixed(1);
  // Pin path authored on a 512 canvas, then scaled/translated toward centre.
  const pin = [
    `M ${p(256)} ${p(86)}`,
    `C ${p(190)} ${p(86)}, ${p(138)} ${p(138)}, ${p(138)} ${p(204)}`,
    `C ${p(138)} ${p(296)}, ${p(256)} ${p(430)}, ${p(256)} ${p(430)}`,
    `C ${p(256)} ${p(430)}, ${p(374)} ${p(296)}, ${p(374)} ${p(204)}`,
    `C ${p(374)} ${p(138)}, ${p(322)} ${p(86)}, ${p(256)} ${p(86)} Z`,
  ].join(" ");
  const holeR = 48 * s * pinScale;
  const holeCy = p(198);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${INDIGO}"/>
    <path d="${pin}" fill="#ffffff"/>
    <circle cx="${p(256)}" cy="${holeCy}" r="${holeR}" fill="${INDIGO}"/>
  </svg>`;
}

const icons = [
  { file: "icon-192.png", size: 192, radius: 42, pinScale: 0.86, bg: true },
  { file: "icon-512.png", size: 512, radius: 112, pinScale: 0.86, bg: true },
  // Maskable: square (no rounded corners → no transparent edges), pin in the safe zone.
  { file: "maskable-512.png", size: 512, radius: 0, pinScale: 0.68, bg: true },
];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage();
for (const ic of icons) {
  await page.setViewportSize({ width: ic.size, height: ic.size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${svg(ic)}</body></html>`,
    { waitUntil: "load" },
  );
  await page.screenshot({ path: join(OUT, ic.file), clip: { x: 0, y: 0, width: ic.size, height: ic.size } });
  console.log("wrote", ic.file);
}
await browser.close();
