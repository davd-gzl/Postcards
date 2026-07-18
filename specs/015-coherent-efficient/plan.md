# Implementation Plan: Coherent & Efficient Postcards

**Branch**: `015-coherent-efficient` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-coherent-efficient/spec.md`

## Summary

Refit the existing Postcards PWA so it delivers three jobs with no friction — **log fast, show a friend, journal & publish** — while making the offline/online model coherent, the data durable, and the whole thing fast on phone and laptop. This is primarily an **information-architecture, interaction, durability and packaging** effort over the current codebase, not a rewrite: no new backend, no new datasets, no OAuth. Work ships **theme by theme**, each screenshot-verified before it is called done.

Technical spine of the approach:
- A single `offlineMode` already exists; make it the *only* egress gate and remove the per-map "detailed map" control (Theme 1).
- A navigation/selection layer (shared `useUi` store) already links tabs, map fly-to and Places views; extend it so any place tap flies the map **and** selects the list row, add one-tap entry points and the missing search bars, and complete the sort/filter matrix (Theme 2).
- Journal composer is now on-demand; finish its sort/filter/search parity (Theme 3).
- Sharing leads with **QR + one portable file + one-button self-contained site → drag-to-host**; GitHub PAT sync moves behind an "Advanced" disclosure (Theme 4).
- A terse, mode-adaptive intro (Theme 5).
- **Durability**: request `navigator.storage.persist()`, surface persistence state + last-backup time, nudge backups; native Capacitor storage as the strongest tier (Theme 7 durability + Theme 8 native).
- Performance treated as a per-theme gate (map source counts, thumbnail variants, list virtualization where needed) (Theme 6).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Vite build.

**Primary Dependencies**: React + Vite (PWA via vite-plugin-pwa/Workbox), Zustand (state), MapLibre GL JS + PMTiles (map), topojson-client (bundled geometry), Zod (schema/validation), Capacitor (native iOS/Android wrap). Zero-dependency in-house i18n with compile-time key parity (en/fr/ko). No backend, no GAFAM SDKs.

**Storage**: IndexedDB working store; canonical portable **JSON** file (+ Markdown export). Reference vs personal data kept strictly separate. Durability via the Storage persistence API on web and native durable storage under Capacitor.

**Testing**: Vitest (unit), Playwright (e2e) + axe-core (a11y). Compile-time i18n parity acts as a test. Verify discipline: screenshot every UI change (Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).

**Target Platform**: Web-first self-hostable PWA; Capacitor Android (now) + iOS (same codebase). Desktop later via Tauri (out of scope here).

**Project Type**: Single-codebase web app packaged to native (mobile + PWA). Existing layout under `apps/postcards/`.

**Performance Goals**: Primary interactions feel immediate on a mid-range phone and a laptop, including map pan/zoom with the full ~135k-point gazetteer; no perceptible stall on view-switch / place-tap / composer-open.

**Constraints**: Strictly offline-capable and no-backend; privacy by default (no telemetry; egress only on explicit action); one portable human-readable file; WCAG 2.1 AA + keyboard-first; small install (heavy datasets downloaded on demand, never bundled).

**Scale/Scope**: ~6 primary screens (Map, Places, Journal, Trips, Stats, Settings) + publish reader; single-user local data; libraries up to tens of thousands of personal records and the full world gazetteer.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Impact of this feature | Verdict |
|-----------|------------------------|---------|
| I. Aggregator, never an author | No new reference data invented; packs stay user-supplied; provenance untouched. | ✅ Pass |
| II. Local-first & fully decentralized | Strengthened: one global Offline mode; QR/file transfer and drag-to-host publishing need no server; **no OAuth/proxy**. | ✅ Pass (reinforces) |
| III. Privacy by default | Egress consolidated behind one explicit switch; Monuments-near-me uses on-device location on explicit action only. | ✅ Pass (reinforces) |
| IV. One portable, human-readable file | Backup/restore and QR/file transfer are built on the existing JSON file; durability makes it central. | ✅ Pass (reinforces) |
| V. Zero lock-in | GitHub demoted to optional; publish targets any zero-login static host; no proprietary deps added. | ✅ Pass (reinforces) |
| VI. Security — data is inert | Imports still validated/sanitized; published site stays inert & self-contained; QR payload is the same validated file. | ✅ Pass |
| VII. Efficient, accessible, keyboard-first | Core goal: speed + one-tap flows; every new control carries title/aria; WCAG maintained. | ✅ Pass (reinforces) |
| VIII. Interoperable & AI-friendly | Formats unchanged (versioned JSON + Markdown); no schema break required. | ✅ Pass |

**Result: PASS — no violations.** This feature tightens the constitution rather than bending it. The one historically-tempting violation (a backend/proxy for GitHub OAuth) is explicitly rejected in the spec (FR-018, Out of Scope). No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/015-coherent-efficient/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI/interaction + file/transfer contracts)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

Work lands in the existing app; no new top-level projects.

```text
apps/postcards/
├── src/
│   ├── app/                 # App shell, top bar, tab nav, keyboard shortcuts (Theme 1/2/5)
│   ├── features/
│   │   ├── map/             # MapView, MapScreen — mode gating, place-tap↔list selection, perf (T1,T2,T6)
│   │   ├── visits/ places/  # Places views: Favorites/Wishlist/Monuments/near-me, search, sort/filter (T2)
│   │   ├── journal/         # Composer-on-demand, sort/filter/search parity (T3)
│   │   ├── trips/           # This-trip filter surfaced across map/lists/journal (T2)
│   │   ├── backup/          # Export/import; QR transfer; last-backup + durability nudges (T4,T7)
│   │   ├── publish/         # One-button self-contained site + drag-to-host guidance (T4)
│   │   └── settings/        # Grouped online controls; GitHub behind "Advanced" (T1,T4,T5)
│   ├── lib/
│   │   ├── store/           # Zustand: useSettings (mode), useUi (nav/selection), useUpdate, new persistence store
│   │   ├── db/              # IndexedDB working store + persistence request/reporting (T7)
│   │   ├── map-source/      # bundledMapSource: offline base + osm; mode-driven (T1)
│   │   ├── publish/         # renderReader (self-contained site) (T4)
│   │   └── i18n/            # en/fr/ko, compile-time parity
│   └── ui/                  # Shared components (ConnectionStatus toggle, IntroScreen, QR view, banners)
├── android/                 # Capacitor Android shell (T8)
├── ios/                     # Capacitor iOS shell (T8)
└── tests/{unit,e2e}/        # Vitest + Playwright + axe
```

**Structure Decision**: Single existing app (`apps/postcards/`) packaged to native via the already-present `android/` and `ios/` Capacitor shells. No backend or additional project is introduced; each theme maps to existing feature folders above.

## Phased rollout (execution order = spec priorities)

Each theme is an independently shippable slice, verified by screenshot/e2e, committed, and deployed before the next.

1. **P1 — One Online/Offline mode** *(map-source + settings)*: make `offlineMode` the sole egress gate; delete the per-map detailed-map toggle; regroup all online controls in Settings; the top-bar chip stays the switch. Verify SC-001.
2. **P1 durability — Long-term memory** *(db + backup)*: `navigator.storage.persist()` on first data write; a persistence/last-backup status surface; backup nudges; verify restore recovers everything (SC-010). Done early because data loss is catastrophic.
3. **P2 — Show-a-friend navigation** *(places + map + ui)*: one-tap Favorites/Wishlist/Monuments-near-me/This-trip; place tap → map fly + list select; add missing search bars; complete sort/filter matrix (SC-002/003).
4. **P3 — Journal parity** *(journal)*: finish sort/filter/search; confirm 1-tap compose (SC-004).
5. **P4 — Effortless sharing** *(backup + publish + settings)*: QR transfer; one-button self-contained site + drag-to-host guidance; GitHub PAT behind "Advanced" (SC-005/006/009).
6. **P5 — No-blabla onboarding** *(ui/IntroScreen)*: terse, mode-adaptive (SC-008).
7. **P6 — Speed & mobile** *(cross-cutting)*: verified on each theme; dedicated pass for map source counts, thumbnails, list virtualization, and always-visible mobile detail photo (SC-007).
8. **P7 — Native via Capacitor** *(android/ios)*: build + run from one codebase; durable native storage; status bar/safe-area/keyboard/haptics; offline parity (SC-011).

## Complexity Tracking

No constitution violations — table intentionally empty.
