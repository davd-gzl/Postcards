# Handoff: place categories (monuments / heritage / museums / neighbourhoods)

**For:** a Claude (or human) running **locally, with open network access**.
**Why this exists:** the cloud sandbox that scaffolded this feature has a network
policy that blocks `query.wikidata.org`, `whc.unesco.org`, Overpass, and every
non-GitHub data host, so the *datasets* couldn't be fetched there. The **code
framework is built, wired, and tested**; what remains is **data vendoring**,
which needs a machine that can reach these sources.

Everything here must stay inside the project **constitution**
(`.specify/memory/constitution.md`), especially **Principle I — "aggregator,
never an author"**: every world fact comes from a **named, openly-licensed
dataset with recorded provenance**. Do **not** hand-type site lists. Missing data
is a *dataset* task (a build script that vendors a static JSON), never inlined
app data.

---

## What already exists (done, green, on `main`)

A generic "category coverage" seam, proven with a first category — **UNESCO World
Heritage Sites** — modelled exactly like the existing `airport` place kind:

- **Schema:** `PlaceRef.kind` now includes `"heritage"` (`src/lib/schema/models.ts`).
  Additive + fail-closed, like `airport`.
- **Reference type:** `HeritageSite` (`src/lib/reference/types.ts`).
- **Reference data:** loads `public/reference/heritage.json`, indexes by id and by
  country, and exposes `allHeritage()` / `heritageOf(iso2)` / `heritageById(id)` /
  `searchHeritage(q)` (`src/lib/reference/referenceData.ts`).
- **Search:** heritage sites appear in the unified place search
  (`src/features/visits/search.ts`), so they can be logged like any place.
- **Stats:** per-country **"% of heritage sites visited"** — `CountryCoverage`
  gained `heritageVisited/heritageTotal/heritagePct`
  (`src/features/stats/computeStats.ts`), rendered as a bar in each country card
  **only when that country has sites** (`src/features/stats/StatsView.tsx`).
- **Build script:** `scripts/build-heritage.mjs` (Wikidata, CC0).
- **Data file:** `public/reference/heritage.json` = `[]` (empty placeholder).
- **Tests:** `tests/unit/heritage.spec.ts` exercises the wiring with injected data.

Because the data file is empty, the feature is **dormant but correct**: nothing
renders yet, no test fails. Populate the data and it lights up with zero code
changes.

Verify the baseline first:

```bash
cd apps/postcards
pnpm install
pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e   # all green
```

---

## Step 1 — Populate UNESCO World Heritage (finish the first category)

1. **Fetch the data** (needs network):

   ```bash
   cd apps/postcards
   node scripts/build-heritage.mjs
   # → wrote ~1200 World Heritage Sites across ~170 countries -> public/reference/heritage.json
   ```

   The script queries Wikidata (`P1435 = Q9259`, CC0) for each site's name, ISO
   3166-1 alpha-2 country, and coordinates. If Wikidata is rate-limiting, add a
   polite delay/retry; if you prefer the official source, the UNESCO XML
   syndication (`https://whc.unesco.org/en/list/xml/`) is an alternative — but
   check its reuse terms; **Wikidata (CC0) is the cleanest license.**

2. **Sanity-check** the output: expect ~1,150–1,250 sites; every row has a real
   `countryIso2` that exists in `i18n-iso-countries`; coordinates look plausible
   (or `0,0` where Wikidata had none — that's fine, coords are only for the map).

3. **Record provenance** — append to
   `src/lib/reference/data/provenance.json` (keep `dataset` ≤ 100 chars, it's
   validated):

   ```json
   {
     "dataset": "UNESCO World Heritage Sites (via Wikidata, CC0)",
     "license": "CC0-1.0",
     "version": "build-heritage.mjs",
     "url": "https://www.wikidata.org"
   }
   ```

4. **(Optional) map markers.** Heritage sites have coordinates but no map pin yet.
   To add one, mirror the airport marker path in `src/features/map/MapView.tsx`
   (`makeAirportPin` / the `airports` source+layer) with a distinct glyph (e.g.
   `🏛`) and feed it from `visitedHeritagePoints(...)` (add a helper next to
   `airportPoints` in `visitedLayers.ts`).

5. **Verify + screenshot + commit:**

   ```bash
   pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
   # optional: refresh README shots — pnpm build && pnpm preview, then
   #   OUT_DIR=../../docs/screenshots node scripts/readme-shots.mjs
   ```

   Add an e2e like `tests/e2e/heritage.spec.ts`: search a famous site, mark it,
   assert the "Heritage sites" bar shows `1/N` on the Stats country card.

**Acceptance:** on Stats, a visited-country card shows a "Heritage sites"
progress bar (e.g. *France · 3/53 UNESCO*), and the sites are searchable/loggable.

---

## Step 2 — Add more categories ("historical, places, quartier…", per country)

The framework generalises. Two clean ways to add categories:

### A. More "one dataset → one category" types (simplest)

Repeat the heritage pattern for any bounded, openly-licensed set, e.g.:

- **National parks** — Wikidata `P31 = Q46169` (national park) or per-country
  protected-area datasets (many are public domain / CC BY).
- **Ramsar wetlands, biosphere reserves**, etc. — Wikidata, CC0.

Each = a `build-<x>.mjs` + a `public/reference/<x>.json` + a `kind` + the same
reference/search/stats wiring. Consider **refactoring the three near-identical
blocks** (heritage/airport/future) into a small generic `CategorySource`
(`{ key, kind, glyph, load(), byId(), of(iso2), search() }`) so new categories are
a few lines. That refactor is the real "framework" payoff — do it once you have a
second category to prove the shape.

### B. Rich per-city categories from OpenStreetMap (museums, monuments, quartiers)

This is the "Paris museums %", "quartiers", "places" ask. The data is
**OpenStreetMap (ODbL)** — comprehensive and openly licensed, but it needs an
extraction pipeline (not a single file):

- **Museums:** `tourism=museum`; **monuments/memorials:** `historic=monument`,
  `historic=memorial`, `historic=castle`, `historic=archaeological_site`;
  **squares:** `place=square`; **neighbourhoods/quartiers:** `place=neighbourhood`
  / `place=quarter` / `place=suburb`.
- **How:** query the **Overpass API** (`https://overpass-api.de/api/interpreter`)
  per city bounding box (or per admin area via `area[...]`), OR process a
  **Geofabrik** country/region `.osm.pbf` extract with `osmium`/`pyosmium`. Overpass
  is easiest to start; pbf scales better and is friendlier to their servers.
- **Shape it** into the *same* `{ id, name, countryIso2, lat, lon, category }`
  plus a **`cityId`** so coverage can be **per city** (e.g. "Paris: 3/18 museums"),
  which is what "per-city monument %" wants. Add `museumsOf(cityId)` alongside
  `heritageOf(iso2)`, and a per-city coverage metric in `computeStats.ts`.
- **"Adapted to each country":** which categories are meaningful varies (e.g.
  *quartiers* in France, *barrios* in Spain, *wards* in Japan). Drive the visible
  categories from a small **per-country config** (a named table of which
  categories/labels apply), sourced or documented — don't invent per-country
  rules ad hoc in components.
- **Licensing:** ODbL requires **attribution** and share-alike of the derived
  dataset. Record provenance, credit "© OpenStreetMap contributors", and keep the
  extracted dataset shareable (it's "a separate shareable dataset", per the
  constitution).
- **Size/offline:** OSM POIs are large. Bundle **per-country** (or per-city)
  shards loaded on demand and SW-cached, so the app stays offline-first without
  shipping a giant JSON. Don't fetch OSM at runtime — that would break the
  zero-network privacy guarantee; vendor at build time only.

**Non-negotiables to keep (verify each still holds):**

- Zero network at runtime — datasets are bundled static assets, SW-cached; the
  `privacy.spec.ts` e2e must still pass.
- Provenance recorded for every dataset; attribution shown in-app (`Attribution`).
- Accessibility (the axe WCAG gate `a11y.spec.ts` must stay green).
- Additive schema (`kind` enum only grows; old files still validate).
- `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` all green before commit.

---

## Suggested order

1. Run `build-heritage.mjs`, add provenance, verify, commit → first real category live.
2. Add heritage **map markers** + an e2e.
3. Refactor the duplicated reference/search/stats blocks into a generic
   `CategorySource` (now that heritage + airports show the shape).
4. Add **national parks** (Wikidata) as the second drop-in category to prove the
   generic path.
5. Tackle **OSM per-city** museums/monuments/quartiers (the big one) with a
   per-country config for what's shown where.

The framework is ready; each step above is mostly *data + a thin wire-up*, exactly
as airports and heritage already demonstrate in the codebase.
