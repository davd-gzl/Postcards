# Implementation Plan: Journal Publish mode (shareable travel-blog website)

**Feature Directory**: `specs/012-journal-publish` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-journal-publish/spec.md`

## Summary

Add a separate **Publish mode** that turns a user-selected slice of the private journal — one trip, a
date range, or a tag — into a **self-contained, read-only travel-blog website** hostable on any static
host or git remote (GitHub Pages, Netlify, Nextcloud, USB, a plain folder) with **no server**. The app
stays the private editor. The published reader is a Polarsteps-style "book you discover": a **cover**
(title, date range, totals), a **journey map** with every step in visit order and the **transport legs**
between them (great-circle arcs by mode), then one **photo-led page per step** (hero photo, place, date,
story, gallery) paged **left→right** with arrow keys and swipe, reduced-motion respected, WCAG 2.1 AA.

The journey is **derived from Trips** (the route + transport) with **stories and photos attaching to
places**. The build produces a **portable bundle** through a pluggable **publish-target seam**: a local
download target that touches no network (default, zero lock-in) and **one optional GitHub Pages
connector** (token or device-flow) with a **Sync** button. Photos are **EXIF/GPS-stripped**; free text
is escaped to stay inert. An **optional client-side passphrase** encrypts the payload with WebCrypto
AES-GCM, decrypted only in the visitor's browser (passphrase never in the files), working on a static
host with no server; a server env-var **Basic-Auth** route is documented separately for self-hosters. A
**README** ships inside every export (mirrored in `docs/`). The route map reuses the bundled Natural
Earth geometry and keeps Natural Earth / OpenStreetMap attribution; **no analytics by default**.

This feature is **purely additive** and reuses existing seams — no new runtime dependency, no new
reference data, no change to how the private app behaves.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18 (build/tooling only for the emitted reader, which ships
as plain HTML/CSS/JS).

**Primary Dependencies**: No new third-party runtime deps. Reuses the app's existing stack (Vite, Zod,
Zustand) and the browser's built-in **WebCrypto (SubtleCrypto)** for AES-GCM + passphrase KDF. Bundle
packaging reuses `lib/download.ts`; a folder/zip is assembled in-memory on-device. The optional GitHub
connector uses the GitHub REST API (Contents + Pages) via `fetch` with a user-supplied token or the
device-authorization flow — behind the publish-target seam, never a hard dependency.

**Storage**: Reads only the user's existing on-device data (visits, trips, stories) via the portable
schema. The bundle's data payload is a **filtered, EXIF-stripped projection** — optionally
AES-GCM-encrypted. Nothing new is persisted; the canonical backup stays the portable JSON file.

**Testing**: Vitest (selection filters, journey derivation/ordering, distance/totals, EXIF-strip,
encrypt/decrypt round-trip + wrong-passphrase failure, bundle self-containment — no external URLs in the
emitted HTML, additive `tags` schema round-trip). Playwright + `@axe-core/playwright` (build a bundle,
open it offline in a fresh browser context, page with arrows/swipe, verify zero external requests, audit
WCAG 2.1 AA on the reader, exercise the passphrase gate).

**Target Platform**: The app runs as today (PWA + Capacitor). The **published site** targets any modern
browser on any static host; the reader is self-contained and requires no server.

**Project Type**: Additive feature within the single local-first app, plus a small emitted static-site
reader packaged into the bundle.

**Performance Goals**: Build a typical journey (tens of steps, dozens of photos) on-device without
blocking the UI; the reader lazy-loads already-downscaled images and pages instantly under reduced
motion; the route map draws from bundled geometry with zero network.

**Constraints**: Fully on-device build; zero telemetry; local-download target contacts no network; the
published site makes no request beyond its own bundled assets; data files (and the emitted payload) are
inert — rendered, never executed; WCAG 2.1 AA; Natural Earth / OpenStreetMap attribution preserved.

**Scale/Scope**: New `Publish` screen and a `publish-target` seam. Scope selection over existing
visits/trips/stories; one additive optional `tags` field on stories (schema-version bump). Bundle size
is bounded by the selected photos, which are already downscaled on capture.

## Constitution Check

*GATE: Must pass before implementation. Re-checked after design.*

| # | Principle | How this plan complies | Status |
|---|-----------|------------------------|--------|
| I | Aggregator, never an author | Publishes only the user's own personal records (visits, trips, stories) and **derived** facts (route from trips, great-circle distance/totals). Invents no world facts; the route map reuses named openly-licensed Natural Earth geometry with preserved attribution. | ✅ PASS |
| II | Local-first & decentralized | The build runs **entirely on-device**; the output is a portable bundle for **any** static host or git remote. The default local-download target needs no network, no account, no server. GitHub is one optional connector, never required. | ✅ PASS |
| III | Privacy by default | No telemetry in the app or the published site. Data leaves the device only through the explicit export/connector the user invokes; local download touches no network. Photos are **EXIF/GPS-stripped**; an optional passphrase encrypts the payload; no analytics unless a self-hoster adds their own. | ✅ PASS |
| VI | Security by design — data is inert | The emitted data payload is **rendered, never executed**; story text and captions are escaped so a shared page can't form raw HTML, script, or a tracking pixel. Encryption uses standard WebCrypto AES-GCM; a wrong passphrase reveals nothing. The private app keeps validating/sanitizing all imports. | ✅ PASS |
| V | Zero lock-in / no proprietary deps | The bundle is plain, relative-path static files runnable anywhere; **no Google**, no proprietary SDK, no host-side build step. Encryption uses built-in WebCrypto (no new dep). "Push to GitHub" sits **behind the publish-target seam** so the app never hard-depends on it. | ✅ PASS |
| IV | One portable, human-readable file | The canonical backup stays the portable JSON file; the published site is a one-way share artifact (not re-importable). The `tags` addition is additive/optional with a documented schema-version bump; old files import unchanged. | ✅ PASS |
| VII | Efficient, accessible, keyboard-first | The reader pages with arrow keys and swipe, respects `prefers-reduced-motion`, and targets WCAG 2.1 AA (axe-audited); the gallery reuses the app's accessible lightbox pattern (arrow paging, Escape, focus return). | ✅ PASS |
| VIII | Interoperable & AI-friendly | Output is open, inspectable HTML/CSS/JS + a documented JSON payload; the host README documents structure, passphrase, Basic-Auth, and analytics. | ✅ PASS |
| — | Ecosystem & shared offline maps | The reader's map reuses the **bundled offline basemap geometry** through the same no-app-private-path principle as `MapSource`; zero external tile calls, consistent with the offline-map ecosystem constraint. | ✅ PASS |

**Result**: No violations. Complexity Tracking below is intentionally empty.

## Reused Seams (no re-invention)

- **Portable schema** (`lib/schema/models.ts`): the selection reads `PostcardsFile` data (`visits`,
  `trips`, `stories`, `PlaceRef`, `Photo`). Add an **additive optional** `tags: string[]` to
  `StorySchema` and bump `SCHEMA_VERSION`; older files import unchanged.
- **Trip arcs** (`features/map/visitedLayers.ts` — `tripArcs`, `greatCircle`): reused to draw the
  journey route as great-circle arcs in the reader's map, styled by transport mode.
- **Travel distance** (`features/travel/distance.ts` — `haversineKm`, `travelTotals`): reused for the
  cover's distance total; a coordinate-less endpoint contributes no distance (never fabricated).
- **Bundled basemap** (`public/basemap/countries-50m.json`, Natural Earth, public domain) and the
  `poster.ts` projection approach: the reader embeds this geometry to render the world **offline**,
  keeping Natural Earth / OSM attribution.
- **PhotoGallery** (`features/visits/PhotoGallery.tsx`): its accessible lightbox pattern (arrow paging,
  Escape close, focus return) is mirrored by the reader's per-step gallery.
- **Photo pipeline** (`lib/image/downscale.ts`): the canvas re-encode that already drops metadata is
  reused/re-applied on build to **guarantee** EXIF/GPS is stripped from every published photo.
- **Journal/Travel data** (`store/useStories`, `store/useTrips`, `store/useVisits`): the selection reads
  from these stores; nothing is written back.
- **MapSource principle** (`lib/map-source/`): the new **publish-target seam** mirrors it — a small
  interface with a default local implementation and an optional connector, no hard-coded dependency.
- **Download** (`lib/download.ts`): reused to save the assembled bundle locally.

## Project Structure

### Documentation (this feature)

```text
specs/012-journal-publish/
├── spec.md              # This feature's specification
└── plan.md              # This file
```

### Source Code (additive)

```text
apps/postcards/
├── src/
│   ├── features/
│   │   └── publish/
│   │       ├── PublishScreen.tsx     # scope select + preview + target/passphrase + Build/Sync
│   │       ├── selection.ts          # scope filters (trip | date range | tag) over visits/trips/stories
│   │       ├── journey.ts            # derive ordered steps + transport legs from trips/stories
│   │       ├── buildBundle.ts        # assemble the self-contained site (reader + payload + geometry + README)
│   │       ├── encrypt.ts            # WebCrypto AES-GCM + salted KDF; wrong-passphrase fails closed
│   │       ├── stripExif.ts          # canvas re-encode to guarantee no EXIF/GPS in published photos
│   │       └── reader/               # the emitted static reader (cover, page, map, gallery, decrypt prompt)
│   │           ├── reader.html.ts    # self-contained HTML shell (relative paths only)
│   │           ├── reader.ts         # book paging, keyboard/swipe, reduced-motion, decrypt-on-load
│   │           ├── readerMap.ts      # bundled-geometry world + great-circle arcs (reused logic)
│   │           └── reader.css.ts     # theme-aware, accessible styles
│   └── lib/
│       └── publish-target/           # the seam (mirrors lib/map-source/)
│           ├── types.ts              # PublishTarget interface + PublishResult
│           ├── localDownloadTarget.ts# default; assembles + downloads the bundle, no network
│           └── githubPagesTarget.ts  # optional connector (token/device-flow) + Sync
├── public/
│   └── basemap/countries-50m.json    # (existing) reused geometry embedded into bundles
└── tests/
    ├── unit/                         # selection, journey, distance, encrypt round-trip, EXIF strip, self-containment, tags schema
    └── e2e/                          # build → open bundle offline → page/swipe → axe audit → passphrase gate
docs/
└── PUBLISHING.md                     # host-facing docs, mirrored into each export's README
```

**Structure Decision**: A new `features/publish` module plus a `lib/publish-target` seam that mirrors
the existing `lib/map-source` seam (default local implementation + one optional connector). The reader
is authored under `features/publish/reader/` and emitted as self-contained static files, so it depends
on nothing at host time. All map, arc, distance, gallery, and photo logic is **reused**, not rebuilt.

## Approach

1. **Schema** (`lib/schema/models.ts`): add optional `tags: string[]` to `StorySchema` (bounded,
   sanitized), bump `SCHEMA_VERSION`, keep it additive so old files import unchanged; regenerate the
   published JSON Schema and add a round-trip test.
2. **Selection** (`features/publish/selection.ts`): pure functions filtering visits/trips/stories by
   scope — `{ kind: "trip" | "dateRange" | "tag", ... }` — returning the in-scope trips, stories, and
   their places. Empty selection is detectable so the UI can disable Build.
3. **Journey** (`features/publish/journey.ts`): order the selected trips by date into steps + legs
   (reusing endpoint places), attach stories/photos to each step's place, fold in stories that have no
   trip leg as date-ordered standalone steps, and compute the cover (title, date range, totals via
   `travelTotals`). No fabricated transport or distance.
4. **EXIF strip** (`features/publish/stripExif.ts`): re-encode each photo through the existing downscale
   canvas path so no metadata survives into the payload.
5. **Reader** (`features/publish/reader/`): a self-contained book — cover → map → per-step pages —
   with left/right paging by arrow key and swipe, `prefers-reduced-motion` honoured, an accessible
   gallery lightbox, and an on-load passphrase prompt when the payload is encrypted. The map reuses the
   bundled geometry + `tripArcs`/`greatCircle` and shows Natural Earth / OSM attribution. Story text and
   captions are escaped to inert output.
6. **Encryption** (`features/publish/encrypt.ts`): WebCrypto — derive an AES-GCM key from the passphrase
   via a salted KDF (PBKDF2-SHA256, per-build random salt + IV stored with the ciphertext); encrypt the
   JSON payload; the reader decrypts in-browser. The passphrase is never written to any file; a wrong
   passphrase fails to authenticate and reveals nothing.
7. **Bundle** (`features/publish/buildBundle.ts`): assemble `index.html` (relative paths only), reader
   JS/CSS, the (optionally encrypted) data payload, embedded photos, the bundled basemap geometry, an
   attribution notice, and the **host README** — all self-contained, no host-side build step.
8. **Target seam** (`lib/publish-target/`): `PublishTarget` interface; `localDownloadTarget` (default,
   no network) assembles + downloads; `githubPagesTarget` (optional connector) authorizes via token or
   device-flow, pushes the prebuilt bundle to a Pages branch, and supports **Sync**. Removing the
   connector leaves local download fully functional.
9. **UI** (`features/publish/PublishScreen.tsx`): scope picker, a **live preview using the same reader**,
   a passphrase toggle, a target chooser, and Build / Sync — added as a mode reachable from the app
   shell, keyboard-operable and labelled.
10. **Docs** (`docs/PUBLISHING.md` + README-in-export): how to host (static host, GitHub Pages,
    Nextcloud, USB), how the client-side passphrase works and its no-recovery caveat, the optional
    **server env-var Basic-Auth** route (separate from the passphrase), how to add your own analytics,
    and the preserved dataset attribution.

## Testing

- **Unit**: scope filters (trip / date range / tag) select exactly the right items; journey ordering and
  standalone-story folding; cover totals via reused distance (coordinate-less endpoint excluded);
  EXIF/GPS absent from re-encoded photos; encrypt→decrypt round-trip and wrong-passphrase failure;
  emitted HTML contains no absolute/external URLs (self-containment); text/caption escaping is inert;
  additive `tags` schema round-trip and backward-compatible import.
- **e2e (Playwright + axe)**: build a bundle, open it in a fresh **offline** browser context, confirm
  the cover/map/pages render with **zero external requests**, page with arrow keys and swipe, open and
  page the gallery, audit the reader for **WCAG 2.1 AA**, and verify the passphrase gate (locked without,
  decrypts with the correct passphrase).
- **Regression**: existing Vitest + Playwright suites stay green; the private app's offline / privacy /
  a11y / inert-import guarantees are unchanged.

## Risks & Mitigations

- **Self-containment regressions** (an accidental external URL, font, or tile call) → a unit test scans
  the emitted HTML/CSS/JS for non-relative references and the e2e run asserts zero external requests.
- **Bundle size** from many photos → photos are already downscaled on capture; the reader lazy-loads;
  the preview surfaces the approximate size before building.
- **Encryption misuse** (weak KDF, reused IV, passphrase leakage) → standard WebCrypto AES-GCM with a
  per-build random salt and IV; the passphrase is never written to disk; round-trip and
  wrong-passphrase tests guard it. The no-recovery caveat is documented for the host.
- **GitHub connector coupling** → strictly behind the publish-target seam; local download is the default
  and is tested to work with the connector absent, proving no hard dependency (SC-007).
- **Map performance in the reader** → reuse the poster's proven projection over the bundled geometry and
  the app's arc logic, not a heavyweight tiled map, so the route draws quickly and offline.

## Complexity Tracking

> No Constitution Check violations — this table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
