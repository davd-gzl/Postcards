# Review notes — autonomous MVP build (2026-07-01)

Built the runnable Place'Been MVP so you can open it, click around, and correct it. Design is
intentionally plain — refining the look/UX is your job. Everything below is committed and pushed
to `claude/repo-setup-speckit-3magw3`.

## What works right now

A real, running app (React + TS + Vite, MapLibre, IndexedDB), verified by tests + a browser run:

- **US1 — Log a visit**: search cities/countries, pick one, add optional date + note; dedupe (one
  per place, re-log updates); "not in dataset" message when a place isn't in reference data (never
  invents it).
- **US2 — Offline map**: MapLibre world map with **visited countries highlighted** + **city dots**,
  drawn from bundled Natural Earth geometry — fully offline, no Google, no tile server. Degrades
  gracefully if WebGL is unavailable.
- **US3 — Backup/restore**: export the single portable `places.placebeen.json`, re-import it
  (full-fidelity), and export a shareable Markdown map. Imports are validated + sanitized, never
  executed.
- **US4 — Statistics**: countries visited, % of world, cities visited, and **per country BOTH % of
  cities and % of regions** (the thing you asked for).
- **US5 — basics**: keyboard shortcuts (M/A/V/S/B), visible focus, skip link, ARIA labels,
  Intl-based formatting. (Full WCAG audit not yet run — see below.)

## Verified

- `pnpm --filter placebeen test` → **23 unit tests pass** (schema/sanitize, dedupe, stats math,
  backup round-trip, import-security, search).
- `pnpm --filter placebeen build` → **production build + PWA service worker generated**.
- `pnpm --filter placebeen test:e2e` → **browser smoke test passes** (mount → log Paris → Visits →
  Stats). Uses the environment's preinstalled Chromium.
- Screenshots of the map + stats were captured and look correct.

## How to run it (tomorrow)

```bash
pnpm install
pnpm --filter placebeen dev        # open the app locally
pnpm --filter placebeen test       # unit tests
pnpm --filter placebeen test:e2e   # browser smoke test
pnpm --filter placebeen build      # production PWA build
```

Layout: `apps/placebeen/src/{features,lib,ui,app}`; reference data in
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
