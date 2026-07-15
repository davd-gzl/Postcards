# Roadmap

An **honest** account of what is planned or partly done in Postcards, and — just as
important — what is **not built yet**. Everything here is grounded in the repo's specs
(`specs/`), the working task list (`tasks.md`), the performance audit
(`docs/PERFORMANCE.md`), and the actual code under `apps/postcards/src`. No dates, no
promises — this is a map of the open edges, not a release schedule.

Postcards has no server, no account, and no telemetry, so there is no roadmap "we"
beyond the maintainer and contributors. Work is spec-driven (see the
[Development](Development.md) page): a feature gets a `spec.md` before it gets code, so
several items below already have a written, reviewed spec but little or no
implementation. That is deliberate, not neglect.

## How to read this page

Each item is tagged with an honest status:

- **Shipped** — in the code today; listed only where it anchors a partly-done area.
- **Partial** — the core is built; a named phase or slice is not.
- **Spec only** — a reviewed `spec.md` exists; no (or almost no) code.
- **Seam only** — the pluggable interface is built and wired, but the thing that plugs
  into it (a dataset, a tile pack, a native plugin) is not shipped.
- **Follow-up** — a known, scoped improvement captured from an audit, not yet done.

For what already works end-to-end, see [Features](Features.md). For the principles that
constrain *how* any of this may be built, see
[Privacy and the Constitution](Privacy-and-Constitution.md).

---

## Intra-city places — stations, districts, parks, landmarks

**Status: Spec only.** Spec: [`specs/014-intra-city-places/spec.md`](../specs/014-intra-city-places/spec.md)
· tasks: [`specs/014-intra-city-places/tasks.md`](../specs/014-intra-city-places/tasks.md)

The plan is to extend the place hierarchy one level deeper — **country → city →
sub-place** — so you can remember the metro/rail station by your hotel, the
neighbourhood you wandered, a park, or a landmark, using the same visit record as a city
or a monument. Visiting a sub-place would still count its parent city and country by
derivation (coverage stays derived, exactly like today's country-from-city rule).

**What exists:** the spec and a dependency-ordered task breakdown. **What does not:** any
code. `PlaceRef.kind` in `src/lib/schema/models.ts` is still the closed set
`country | city | airport | heritage | custom` — there is no `station` or `district`
kind, no sub-place source seam, and no per-city availability index.

**The real blocker is data, not UI.** Constitution I (*aggregator, never an author*)
forbids inventing sub-places, so the feature cannot ship a category until a **named,
openly-licensed dataset** backs it — OpenStreetMap metro/rail stations and admin
districts (ODbL), Wikidata QIDs — each with recorded provenance. The spec's *Out of
Scope* is explicit that curating and building those datasets is a **separate dataset
effort, never app code**; task **T006** is the build step that turns the source data
into per-city shards plus an availability index. Until that dataset and build step exist,
the honest behaviour is exactly what the spec calls for: a city with rich open data
offers many sub-place types, a city with only station data offers only stations, and a
city with none offers only the existing "add your own place" custom path — nothing
fabricated, no empty categories. See [Data and provenance](Data-and-Provenance.md) for
how reference datasets earn their place.

Loading is designed to mirror the existing two-stage gazetteer: a cheap availability
index decides what to offer, then a city's shard is fetched **lazily, only when that city
is opened**, and cached for offline use — never a blanket upfront load.

---

## Device sync — direct peer-to-peer (Phase 2)

**Status: Partial — git mode shipped, P2P not built.** Spec:
[`specs/013-device-sync/spec.md`](../specs/013-device-sync/spec.md)

Cross-device sync already works in **git mode**: pull the portable JSON from a git
remote, **merge record-by-record** (id-keyed upsert, newest-wins, with tombstones for
deletions), and push — reusing the same connector as Publish mode's Sync button. The
convergent merge core (`src/lib/sync/merge.ts`), the sync engine
(`src/lib/sync/engine.ts`), the UI, and the schema support (`updatedAt` + tombstones,
schema v6 / DB v4) are all in the tree. The full story is on the
[Device sync](Device-Sync.md) page.

**Not built: direct device-to-device sync with no cloud** — User Story 4 in the spec,
marked **Priority P3, Phase 2**. The idea is to pair a phone and a laptop on the same
local network by **scanning a QR code**, open an **encrypted peer-to-peer channel**
(WebRTC / local network), and run the *same* record-level merge over that channel, so no
third party ever touches the data even in transit. There is no WebRTC, signalling, or
QR-pairing code in the repo today. The spec is candid about why it waits: it honours the
constitution most fully but is materially heavier (pairing, signalling, a data channel)
and is **not needed** to deliver working cross-device sync, which git mode already does.
The merge model git mode proves is exactly what P2P would reuse.

---

## Map data loading — the deeper wins

**Status: P1 + P2a shipped; P2b–P7 are follow-ups.** Source:
[`tasks.md`](../tasks.md) ("Map data loading") and [`docs/PERFORMANCE.md`](../docs/PERFORMANCE.md).

The world gazetteer is ~135k cities (~17 MB of JSON). Two optimizations have **shipped**:

- **P1 — spatial grid index.** The per-pan viewport query no longer linearly scans all
  135k rows; cities are bucketed into a 1°×1° grid once and a zoomed-in view visits only
  the handful of cells it covers (`src/features/map/viewport.ts`).
- **P2a — prime geometry early.** `getCountries()` fetching starts at map mount, so it
  overlaps initialization rather than waiting.

The following are **ranked, scoped follow-ups captured from the loading audit** — real
wins, none of them done yet. Several are build-step work (a preprocessing pipeline that
produces derived artifacts from the human-readable canonical source, per the
constitution's "one portable file" and aggregator rules):

- **P2b — 110m land seed for an instant coastline.** Draw a tiny Natural Earth land
  polygon first so the world has a coastline immediately, before the 50m country
  geometry decodes. Today `public/basemap/` ships `countries-50m.json`, `lakes-110m.json`
  and `rivers-110m.json` — but **no `land-110m` seed**.
- **P2c — geometry in a worker.** Only the *cities* gazetteer parses off-thread today
  (`src/lib/reference/gazetteerWorker.ts`); the `countries-50m` TopoJSON still decodes on
  the main thread.
- **P3 — don't gate first paint on all reference JSON.** `src/main.tsx` currently gates
  the first render on `initReferenceData()`; the core gazetteer parse blocking first
  render is called out in `docs/PERFORMANCE.md` §4 as a deliberate-but-attackable cost.
- **P4 — columnar binary gazetteer (build step).** Replace the row-of-objects JSON with
  a columnar binary layout to cut parse time and memory.
- **P5 — zero-copy worker handoff.** Transfer the parsed gazetteer buffers to the main
  thread instead of structured-cloning them.
- **P6 — kill duplicate downloads.** Ensure a given reference asset is fetched once, not
  by two paths.
- **P7 — pre-simplify country geometry (build step).** Ship geometry already simplified
  for the app's zoom range instead of simplifying at runtime.

Related, still open from the tile-loading workflow: **no-remount-on-toggle** (#7) and a
**more robust offline base** (#8) were deferred as follow-ups after the shipped tile
fixes. See [Architecture](Architecture.md) for how the reference pipeline and map layers
fit together.

---

## Street-level offline basemap (PMTiles)

**Status: Seam only — no world pack shipped.** Spec:
[`specs/004-offline-map-seam/spec.md`](../specs/004-offline-map-seam/spec.md)

The **seam is built and wired**. The app can offer a **"Streets (offline)"** vector
basemap read via the `pmtiles://` protocol behind the `MapSource` interface, and it
consults a device-global **Offline Map Store** (`src/lib/map-source/offlineMapStore.ts`)
for a pack rather than any hard-coded path. The bundled probe even range-GETs the first
7 bytes to verify the PMTiles magic header, so a self-host `try_files` fallback returning
`index.html` can't trick the app into advertising a broken basemap. When a
`world-detail.pmtiles` pack is present, `MapScreen` lights the option up; when it is
absent, the option is simply hidden and nothing else changes.

**What is not shipped is the pack itself.** No street-level world PMTiles pack is bundled,
by design — the constitution requires offline maps to be **device-global / cross-app,
never app-private**, and a world street pack is far too large to ship in-app anyway. So
the app draws its always-available Natural Earth **overview** basemap
(`public/basemap/`, ODbL/PD, see `public/basemap/PROVENANCE.md`) and, opt-in, online OSM.
Two things remain future work:

- **A world PMTiles pack** (Protomaps "basemap" flavour, OpenStreetMap/ODbL), produced
  and installed **out of the app**, dropped where the store looks.
- **The native `SharedOfflineMapStore` plugin** — a Capacitor plugin backing the same
  interface via an iOS **App Group** and Android **SAF / content provider**, so packs are
  shared across the maintainer's app ecosystem. This spec ships the interface; the plugin
  is a later, native deliverable. Downloadable map-pack management UI is likewise out of
  scope for this increment.

---

## Internationalization — strings still in English

**Status: Partial — French & Korean shipped, ~80% coverage.** Code:
`src/lib/i18n/`.

Postcards ships a zero-dependency i18n layer with **typed catalogs** for English,
French, and Korean and **compile-time key parity** (`en.ts` is the source of truth at
~430 keys; `fr.ts`/`ko.ts` track it), a `useT` hook, a language switcher, and
locale-aware `Intl` formatting. English is always the fallback for any missing key.

The honest gap: roughly **80% of user-facing strings are translated**. The still-English
remainder is concentrated in the **detail pages**, the **publish / sync flows**, and a
**few modals** that were flagged for follow-up. Because the fallback chain is
active-locale → English → key text, an untranslated string renders as clean English
rather than a broken key — but it is not yet localized. Adding more languages is
mechanical (a new typed catalog that satisfies the key set); finishing the fr/ko coverage
of the flagged areas is the outstanding work.

---

## Smaller open items

Candid leftovers from the working [`tasks.md`](../tasks.md) — small, but not done:

- **A "Reconnect" button when connectivity returns** — deliberately *not* auto-reconnect;
  show a button, let the user choose.
- **An explicit Offline / Online mode indicator** somewhere visible.
- **A light / dark mode toggle.** Today dark mode only follows the OS; an explicit switch
  is wanted. (The offline basemap palette already tracks the resolved theme.)

Add-a-custom-place discoverability, favourites-as-a-view, and the stats percentage
strip — earlier open items — have since **shipped**; see [Features](Features.md).

---

## Explicitly out of scope

Not "later" — **not planned**, by constitution or product focus. Listed so the roadmap
isn't misread as an intent to build them:

- **Trip planning** — routing, directions, transit schedules. Postcards *remembers*
  places; it is not a planner.
- **Auto-detecting visited places** from location history, transit taps, or photo
  geotags. No tracking; nothing inferred.
- **Any server, account, cloud sync service, or telemetry.** Local-first, decentralized,
  privacy by default (see [Privacy and the Constitution](Privacy-and-Constitution.md)).
- **Comparisons / leaderboards** across users.
- **Google or other proprietary/closed dependencies** — open, replaceable components
  only.
- **Authoring reference data in app code.** Missing data becomes a separate, shareable,
  provenance-tagged dataset — never a fact baked into the app
  ([Data and provenance](Data-and-Provenance.md)).

---

## Where this is tracked

- **Specs** — `specs/NNN-*/spec.md`, one directory per feature. A spec exists before
  code; the presence of a spec is not a promise of a ship date.
- **Working task list** — [`tasks.md`](../tasks.md) at the repo root, grouped by area.
- **Audits** — [`docs/PERFORMANCE.md`](../docs/PERFORMANCE.md) (loading follow-ups),
  `docs/ALGORITHMS.md`, `docs/OFFLINE-MAPS.md`.

Related wiki pages: [Home](Home.md) · [Features](Features.md) ·
[Architecture](Architecture.md) · [Data and provenance](Data-and-Provenance.md) ·
[Device sync](Device-Sync.md) · [Publishing](Publishing.md) ·
[Privacy and the Constitution](Privacy-and-Constitution.md) ·
[Development](Development.md)
