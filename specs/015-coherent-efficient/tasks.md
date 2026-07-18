# Tasks: Coherent & Efficient Postcards

**Input**: Design documents from `/specs/015-coherent-efficient/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: grouped by user story (priority order) so each ships as an independently
verifiable increment. This is an existing app (`apps/postcards/`), so setup is light and
most tasks modify real files. Every UI task ends by **screenshotting the actual pixels**;
every story ends **green on tsc + unit + e2e + build**, deployed to both branches.

**Tests**: e2e/verification tasks are included per story because verifiable, no-vibe delivery
is the explicit goal.

## Path Conventions

App root: `apps/postcards/`. Run all gates from there. Chromium for screenshots:
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

---

## Phase 1: Setup (shared)

- [ ] T001 Confirm baseline gates are green before starting (`cd apps/postcards && npx tsc --noEmit && npx vitest run && npx vite build`) and note current map/list perf on a throttled CPU profile as the "before" reference for US6.

---

## Phase 2: Foundational (blocking prerequisites)

- [ ] T002 Add a `selectedPlace` signal to the nav store in `apps/postcards/src/lib/store/useUi.ts` (a `{ key, nonce }` alongside `mapFocus`), with a `selectPlace(place)` action that sets both fly-to and selection — consumed by US2 (map + list) and reused by US3/US4 place taps.
- [ ] T003 [P] Create a persistence module `apps/postcards/src/lib/db/persistence.ts` exposing `requestPersistence()` (calls `navigator.storage.persist()` once), `getPersistenceState()` (`persisted()`+`estimate()` → granted|denied|unknown), guarded for unsupported environments — used by US7.

---

## Phase 3: User Story 1 — One clean Online/Offline mode (P1) 🎯 MVP

**Goal**: `offlineMode` is the single egress gate; the map carries no detailed-map toggle;
all online controls live grouped in Settings. **Independent test**: offline → zero optional
requests anywhere; no map detailed-map button; Settings groups online controls.

- [ ] T004 [US1] Remove the map-surface online/"Detailed map" button in `apps/postcards/src/features/map/MapScreen.tsx`; derive the basemap solely from `offlineMode` + the Settings online-map preference (keep the top-bar chip as the mode switch).
- [ ] T005 [US1] Audit and close every optional-egress call site so all gate on `offlineMode`: map tiles (`src/lib/map-source/bundledMapSource.ts`, `MapView.tsx`), guide overview+photo (`src/features/guides/GuideButton.tsx`), data-pack fetch (`src/lib/packs/store.ts`, `src/features/settings/DataPacksSection.tsx`), on-demand downloads (`src/features/settings/SettingsScreen.tsx`), and any non-user-required update checks.
- [ ] T006 [US1] Regroup all online-related controls into one clearly-labeled "Online" section in `apps/postcards/src/features/settings/SettingsScreen.tsx`; disable + explain each when Offline mode is on.
- [ ] T007 [P] [US1] Add/adjust i18n keys for the regrouped Settings section in `src/lib/i18n/{en,fr,ko}.ts` (compile-time parity).
- [ ] T008 [US1] e2e in `apps/postcards/tests/e2e/`: intercept network, toggle Offline, exercise map/place/guide/packs/publish-preview, assert **zero** optional requests (SC-001); assert no map detailed-map control.
- [ ] T009 [US1] Screenshot-verify: map (no detailed-map button), Settings online section (online & offline states). Then run all gates, commit, deploy both branches, confirm CI green.

**Checkpoint**: SC-001 met; the recurring "detailed map re-appears" annoyance is gone.

---

## Phase 4: User Story 7 — Durable data / long-term memory (P1, critical) 🎯

**Goal**: data survives a browser-storage reset; persistence requested; backup is easy and
nudged; restore recovers everything. **Independent test**: grant → survives eviction; deny →
warned + restore works.

- [ ] T010 [US7] Add a durability store `apps/postcards/src/lib/store/usePersistence.ts` holding `persistenceState`, `lastBackupAt`, and a `dataDirtySinceBackup` derivation (device-local; NOT in the portable file).
- [ ] T011 [US7] Call `requestPersistence()` on the first real personal-data write (hook into the visits/stories stores or the db layer), not on cold load; store the resulting state.
- [ ] T012 [US7] Update `lastBackupAt` on every confirmed successful export/transfer in `apps/postcards/src/features/backup/` (export + import + the new transfer paths).
- [ ] T013 [US7] Add a compact, non-blocking **protection indicator** (data protected / at-risk + "last backed up …") to Settings → Your data and a gentle prompt when `dataDirtySinceBackup`; wire in `SettingsScreen.tsx` / `features/backup/Backup.tsx`. i18n en/fr/ko.
- [ ] T014 [US7] e2e: assert persistence requested once on first write; simulate denied → warning shown; export then wipe storage (fresh context) → restore file → assert all places/trips/journal/photos/settings recovered (SC-010).
- [ ] T015 [US7] Screenshot-verify the indicator (protected, at-risk, changed-since-backup). Gates, commit, deploy, CI green.

**Checkpoint**: SC-010 met; no path loses data silently.

---

## Phase 5: User Story 2 — Fast "show-a-friend" navigation (P2)

**Goal**: one-tap views; place tap → map fly + list select; search everywhere; full
sort/filter matrix. **Independent test**: reach each view in one tap; tap → both map+list.

- [ ] T016 [US2] Consume `selectedPlace` (T002) in `apps/postcards/src/features/map/MapView.tsx` (fly) and the in-view list in `MapScreen.tsx` (scroll-to + highlight the matching row).
- [ ] T017 [US2] Route every place tap (Places lists, search results, journal place links, stats) through `selectPlace()` so map+list stay in sync — update `src/features/visits/`, `src/features/places/*`, `src/features/journal/JournalScreen.tsx` link handlers.
- [ ] T018 [P] [US2] Add one-tap entry points for Favorites, Wishlist, Monuments-near-me, and This-trip (quick chips/nav in the app shell or Places header) reusing `useUi.openPlaces(view)` + the trip filter; `src/app/App.tsx` / `src/features/places/*`.
- [ ] T019 [US2] Add search bars to every place list still missing one (audit Places/Favorites/Wishlist/Monuments views under `src/features/visits/` & `src/features/places/`); reuse the journal search pattern (accent-insensitive `norm`).
- [ ] T020 [US2] Complete the sort/filter matrix (trip, folder, date, favorite, country, place type), composable, across the place lists; ensure marking a past place visited never forces a current-trip flow.
- [ ] T021 [P] [US2] i18n en/fr/ko for new controls/labels.
- [ ] T022 [US2] e2e: one-tap to each view; tap-from-list and tap-from-search both fly the map AND select the row (SC-002/003); search filters; combined sort/filter works.
- [ ] T023 [US2] Screenshot-verify each view + the map/list linkage on mobile & desktop. Gates, commit, deploy, CI green.

**Checkpoint**: SC-002/003 met; the "show a friend in a bar" flow is one-tap.

---

## Phase 6: User Story 3 — Journal like Polarsteps (P3)

**Goal**: 1-tap compose (done); full sort/filter/search parity. **Independent test**: find any
entry by city/trip/folder/date; compose in one tap.

- [ ] T024 [US3] Add sort + trip/folder filters to the journal feed in `apps/postcards/src/features/journal/JournalScreen.tsx` (search already exists); ensure filters compose with the existing place/year/day filters.
- [ ] T025 [P] [US3] i18n en/fr/ko for the new journal sort/filter labels.
- [ ] T026 [US3] e2e: compose in one tap; create an entry offline (assert no network); find it via search and via each sort/filter (SC-004).
- [ ] T027 [US3] Screenshot-verify journal feed with sort/filter. Gates, commit, deploy, CI green.

---

## Phase 7: User Story 4 — Effortless sharing, GitHub demoted (P4)

**Goal**: QR + one-file transfer; one-button self-contained site → drag-to-host; GitHub behind
Advanced. **Independent test**: transfer with no account; publish + open offline; GitHub never
required.

- [ ] T028 [US4] Evaluate + add the lightest offline QR generate+scan capability (prefer platform `BarcodeDetector` for scan; a tiny/inline generator) per research R3; keep the install small. Record the choice in research.md.
- [ ] T029 [US4] Build a "Transfer to another device" flow in `apps/postcards/src/features/backup/`: portable-file hand-off (share sheet on native / download on web) + a QR view for small libraries with a size-guard fallback to file; receiver imports via the existing validate/sanitize path.
- [ ] T030 [US4] Add a one-button **Publish** that emits the single self-contained `.html` via `src/lib/publish/renderReader`, offers save/share, and shows terse drag-to-netlify-drop instructions; keep the in-app preview.
- [ ] T031 [US4] Move GitHub PAT sync behind an "Advanced" disclosure in `src/features/settings/SyncSection.tsx` / `SettingsScreen.tsx`; make QR/file + Publish the prominent paths. i18n en/fr/ko.
- [ ] T032 [US4] e2e: file transfer round-trips into a second context; QR small-library round-trip + oversized→file fallback message; published `.html` renders offline with no external URL (self-containment test stays green); app fully usable with GitHub unconfigured (SC-005/006/009).
- [ ] T033 [US4] Screenshot-verify the Transfer flow (QR + file), the Publish flow, and Settings (GitHub under Advanced). Gates, commit, deploy, CI green.

---

## Phase 8: User Story 5 — No-blabla onboarding (P5)

**Goal**: terse, mode-adaptive first-run. **Independent test**: first launch shows concise
downloads + online/offline choices; adapts to Offline; same controls in Settings.

- [ ] T034 [US5] Refine `apps/postcards/src/ui/IntroScreen.tsx` to be terse and mode-adaptive: present online/offline + optional downloads concisely, each actionable/skippable; de-emphasize online-only options when Offline is chosen. Trim prose. i18n en/fr/ko.
- [ ] T035 [US5] e2e: first-run (clear intro-seen) shows the concise choices and adapts to Offline; assert the same controls exist in Settings (SC-008).
- [ ] T036 [US5] Screenshot-verify first-run (online + offline) on mobile & desktop. Gates, commit, deploy, CI green.

---

## Phase 9: User Story 8 — Native app via Capacitor (P7)

**Goal**: Android (now) + iOS from one codebase; durable native storage; native feel; offline
parity. **Independent test**: build+run Android; data survives restart; native niceties present.

- [ ] T037 [US8] Add first-party Capacitor plugins (`@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/haptics`, `@capacitor/share`, `@capacitor/filesystem`); wire native transfer share (T029) + a periodic Filesystem JSON backup.
- [ ] T038 [US8] Apply native feel: status-bar styling, safe-area insets (verify existing `env(safe-area-inset-*)`), keyboard handling, haptics on primary actions (log place, save entry, publish). `src/app/` + relevant features.
- [ ] T039 [US8] Verify durable storage in the WebView (IndexedDB persists across restart/update) + Filesystem backup; document the durability tiers.
- [ ] T040 [US8] Build & run the Android app from the one codebase (`npx cap sync android` + build); verify persistence across restart and offline parity (SC-011). Capture device/emulator screenshots.

---

## Phase 10: Polish & cross-cutting (US6 speed/mobile + quality)

- [ ] T041 [US6] Map perf pass: tier/cap the full-gazetteer dot source by zoom and keep source updates incremental in `src/features/map/MapView.tsx`; measure against the T001 baseline on a throttled profile (SC-007).
- [ ] T042 [US6] Virtualize long place/journal lists where measurements show jank; reuse the existing small thumbnail variant in all list/grid rows.
- [ ] T043 [US6] Ensure the city-detail photo is always visible without scrolling on mobile (city/heritage detail views); screenshot-assert on a phone viewport.
- [ ] T044 [P] Accessibility sweep: axe-core clean on changed screens; every new control keyboard-reachable with visible focus, `title`, and `aria` (toggles `aria-pressed`).
- [ ] T045 [P] Update `BACKLOG.md` (mark themes done as verified) and `AGENTS.md` if any workflow detail changed; keep i18n parity.
- [ ] T046 Full regression: tsc + unit + e2e + build green; deploy; confirm Pages + Tests CI green on the final commit.

---

## Dependencies & order

- **Setup (T001)** → **Foundational (T002–T003)** → stories.
- **Story order = priority**: US1 → US7 → US2 → US3 → US4 → US5 → US8, with US6 (polish) woven in and finalized last.
- **US2** depends on Foundational T002 (`selectedPlace`). **US7** depends on T003 (persistence module). **US4/US8** share the transfer path (T029 before T037's native share). Other stories are largely independent and could be reordered if priorities change.

## Parallel opportunities

- Within a story, `[P]` i18n tasks run alongside the implementation task they support.
- T003 (persistence module) can be built in parallel with US1.
- US6 polish items (T041–T043) can progress in parallel once the screens they touch are stable.

## Implementation strategy

- **MVP = US1 + US7** (one coherent mode + durable data): the two trust foundations. Ship and
  demo before proceeding.
- Then deliver US2 → US3 → US4 → US5 incrementally, each independently verified and deployed.
- US8 (native) follows once the web experience is coherent; US6 perf/mobile is enforced on
  every story and finalized in Phase 10.
