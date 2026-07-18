# Quickstart & Validation: Coherent & Efficient Postcards

How to validate each theme end-to-end. Contracts are in `contracts/`; this is the run guide.
All commands run from `apps/postcards/`.

## Prerequisites

```bash
cd apps/postcards
npm ci            # if deps changed
```

Standard gates (run for every theme before it's "done"):

```bash
npx tsc --noEmit                 # zero errors; i18n key parity enforced (en/fr/ko)
npx vitest run                   # unit
npx playwright test              # e2e (+ axe); load-flaky specs pass in isolation
npx vite build                   # production build must succeed (PWA + Capacitor payload)
```

**Verify discipline**: for every UI change, screenshot the actual pixels (Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) before marking done. Deploy each theme
to both branches and confirm the Pages + Tests workflows are green.

## Per-theme validation

### P1 — One Online/Offline mode (C1, SC-001)
1. Load the app; toggle the top-bar chip to Offline.
2. Intercept network in an e2e run; exercise map, a place, a guide, packs, publish preview.
   Expect **zero** optional requests.
3. Inspect the map controls — assert no "detailed map" toggle. Open Settings — assert all
   online controls grouped; online-only ones disabled+explained when Offline.

### P1 durability — Long-term memory (C2, SC-010)
1. Write data; assert the persistence request fired once and state is recorded/shown.
2. In a context where persistence is denied, assert a non-blocking backup warning appears.
3. Export a backup; wipe storage (fresh context); restore the file; assert all places/
   trips/journal/photos/settings return.

### P2 — Show-a-friend navigation (C3, SC-002/003)
1. From cold open, reach Favorites / Wishlist / Monuments-near-me / a Trip in one tap each.
2. Tap a place from a list and from search; assert the map flies **and** the list row is
   selected/scrolled-into-view both times.
3. Assert a search bar on every place list; apply combined sort/filter (trip+date+type).
4. Search a past place, mark visited; assert no forced current-trip step.

### P3 — Journal parity (C4, SC-004)
1. Open Journal; assert no always-open composer; one tap opens it.
2. Create an entry (title/text/photos) offline; assert local save.
3. Search + sort/filter by city/trip/folder/date; assert the entry is found.

### P4 — Effortless sharing (T1/T2, SC-005/006/009)
1. Share → portable file via share sheet/download; import on a second context; assert merge.
2. Small library → Show QR (renders offline); scan → import via the same validation path;
   oversized payload → assert fallback-to-file message.
3. Publish → one self-contained `.html`; open it offline; assert full render + no external
   URL (existing self-containment test). Assert GitHub sync is behind "Advanced" and the app
   is fully usable with GitHub unconfigured.

### P5 — No-blabla onboarding (C5, SC-008)
1. First launch (clear intro-seen); assert terse online/offline + downloads, each
   actionable/skippable; choose Offline → online-only options de-emphasized.
2. Assert the same controls exist in Settings afterward.

### P6 — Speed & mobile (C6, SC-007)
1. Load the full gazetteer; on a throttled CPU profile, pan/zoom/switch views/tap places/
   open composer — assert no perceptible stall.
2. Phone viewport: open a city detail — screenshot-assert the photo is visible without
   scrolling.

### P7 — Native via Capacitor (T3, SC-011)
1. `npx cap sync android` and build the Android app from the one codebase; launch it.
2. Log data; restart the app; assert persistence. Confirm status bar/safe-area/keyboard/
   haptics and offline parity. (iOS builds from the same codebase.)

## Definition of done (per theme)

- Contract behaviors in `contracts/` pass (e2e where feasible, screenshot where visual).
- All four standard gates green (tsc, unit, e2e, build).
- Screenshot captured and eyeballed; deployed to both branches; CI green.
- Relevant Success Criteria (SC-00x) demonstrably met.
