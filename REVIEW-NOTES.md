# Review notes — autonomous MVP build (2026-07-01)

Built the runnable Postcards MVP so you can open it, click around, and correct it. Everything is
committed and pushed to `claude/repo-setup-speckit-3magw3`.

## Update — the big upgrade pass (2026-07-02)

**The gazetteer is real now (T018).** The app bundles 24,323 GeoNames cities (population ≥ 15k,
CC BY 4.0, via `all-the-cities`) with **real GeoNames ids** (Paris = 2988507, exactly the contract
example), served as a ~700KB-gzip cached asset. All 640 French cities are mapped to their ISO
3166-2 regions, so France's %-of-cities/%-of-regions are now against true denominators. Search is
population-ranked (typing "paris" finds Paris, France — not Paris, Texas) and accent-insensitive.

**New UX (the backlog's bigger bets):** tap any country on the map to toggle it visited · toast
with one-tap **Undo** on every add/remove/import · Places tab = **Visited list + browsable
country checklist** with filter (rows jump to the map) · fully keyboard-operable search combobox
(arrows/Enter/Escape, proper ARIA) · **By continent** coverage bars + per-country **Details**
drill-down in Stats · "Fit to my places" button · hollow map dots for the listed in-view cities.

**Test suite:** 50 unit tests (incl. full gazetteer integrity) + 6 e2e: smoke, undo, checklist,
**axe WCAG 2.1 AA gate (T047)**, **keyboard-only flow (T048)**, **zero-external-request privacy
(T052)** — all green. Breaking note: city ids switched from starter slugs to GeoNames ids
(pre-release, no migration needed).

**Still open:** Admin-1 regions beyond France (no offline source vendored yet), PMTiles street
basemap (T033), Capacitor native wiring, CI (T057), license choice.

---

## Update — light redesign + "cities in view" (same session, later)

Reworked the whole UI per your direction: **white/light theme, mobile-first, bottom-nav, simple &
efficient (no-BS, no AI-look)**. New primary screen: **Map on top + a live "Cities in view — most
people first" list below** that updates as you pan/zoom the map; one tap on the round **+ / ✓**
marks a city visited (and it appears green on the map). Search adds any city/country and flies the
map there. Three tabs: **Map · Stats · Places** (Places = your list + backup/import).

Green after the redesign: **typecheck ✓ · 28 unit tests ✓ (added viewport tests) · production build
✓ · Playwright e2e ✓**. Note: the "cities in view" list is only as rich as the loaded gazetteer —
with the ~28-city starter set it's sparse; it becomes powerful once the full GeoNames gazetteer is
vendored (task T018). The design is now intentional, but still yours to tweak tomorrow.

---

### Original build notes (still accurate for the architecture/caveats)

## What works right now

A real, running app (React + TS + Vite, MapLibre, IndexedDB), verified by tests + a browser run:

- **US1 — Log a visit**: search cities/countries, pick one, add optional date + note; dedupe (one
  per place, re-log updates); "not in dataset" message when a place isn't in reference data (never
  invents it).
- **US2 — Offline map**: MapLibre world map with **visited countries highlighted** + **city dots**,
  drawn from bundled Natural Earth geometry — fully offline, no Google, no tile server. Degrades
  gracefully if WebGL is unavailable.
- **US3 — Backup/restore**: export the single portable `places.postcards.json`, re-import it
  (full-fidelity), and export a shareable Markdown map. Imports are validated + sanitized, never
  executed.
- **US4 — Statistics**: countries visited, % of world, cities visited, and **per country BOTH % of
  cities and % of regions** (the thing you asked for).
- **US5 — basics**: keyboard shortcuts (M/A/V/S/B), visible focus, skip link, ARIA labels,
  Intl-based formatting. (Full WCAG audit not yet run — see below.)

## Verified

- `pnpm --filter postcards test` → **23 unit tests pass** (schema/sanitize, dedupe, stats math,
  backup round-trip, import-security, search).
- `pnpm --filter postcards build` → **production build + PWA service worker generated**.
- `pnpm --filter postcards test:e2e` → **browser smoke test passes** (mount → log Paris → Visits →
  Stats). Uses the environment's preinstalled Chromium.
- Screenshots of the map + stats were captured and look correct.

## How to run it (tomorrow)

```bash
pnpm install
pnpm --filter postcards dev        # open the app locally
pnpm --filter postcards test       # unit tests
pnpm --filter postcards test:e2e   # browser smoke test
pnpm --filter postcards build      # production PWA build
```

Layout: `apps/postcards/src/{features,lib,ui,app}`; reference data in
`src/lib/reference/data/`; everything is a pnpm workspace so shared ecosystem packages land in
`packages/` later.

## Important caveats (deliberate shortcuts for a first pass)

1. **Reference data is a small real STARTER subset**, not the full datasets:
   - Countries: the **full** ISO 3166-1 list (via `i18n-iso-countries`) — so "% of world" is
     against ~250 countries (accurate).
   - Regions: **France only** (13 metropolitan regions). Other countries show "regions: dataset not
     loaded" honestly.
   - Cities: ~28 real cities (correct names/coords) but keyed by **slugs** (e.g. `paris-fr`), not
     real GeoNames IDs, because I didn't want to assert GeoNames IDs I couldn't verify offline.
   - → Vendoring the full Natural Earth Admin 1 + GeoNames gazetteer (with real IDs) is **task
     T018** and is the biggest follow-up. When it lands, `% of a country's cities/regions` becomes
     meaningful everywhere.
2. **Map basemap = country polygons**, not street-level PMTiles. This is fully offline and perfect
   for the "which countries/cities" view, but there are no streets/labels yet. The real bundled
   **PMTiles** basemap is task T033, and it slots in behind the existing `MapSource` seam.
3. **Capacitor is config-only.** The web app is complete; native iOS/Android platforms and the
   Filesystem/Share plugins aren't wired yet (web export uses browser download + file input). The
   device-global shared Offline Map Store remains a separate feature.
4. **Not yet done from `tasks.md`**: automated axe/WCAG e2e (T047), keyboard-only e2e (T048),
   dedicated offline + import-security *e2e* (the logic is unit-tested), privacy network test
   (T052), PWA icons, and CI (T057).
5. **License not chosen.** You said open-source / personal / non-commercial — picking the exact
   license (e.g. a non-commercial license vs a standard OSI one) is a decision for you; I left it
   unset rather than choose for you.

## Good first things to react to tomorrow

- The visual design / layout (all yours).
- Whether the map should stay polygon-based for the MVP or prioritize the PMTiles basemap sooner.
- Confirm the reference-data plan: vendor full GeoNames + Natural Earth Admin 1 (T018) — this is the
  highest-impact next step.
- Pick a license.
- Anything about the add-a-visit flow, stats layout, or shortcuts that doesn't match how you'd use it.
