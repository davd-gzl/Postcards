# Quickstart: Trip Reconstruction

How to validate the feature end-to-end. Run from `apps/postcards/`.

## Prerequisites

```bash
pnpm install
pnpm typecheck        # includes i18n en/fr/ko key parity
```

## Automated validation (the gate)

```bash
# Pure logic — distance path, approximate dates, stop reordering, schema round-trip
pnpm exec vitest run tests/unit/tripPathKm.spec.ts tests/unit/tripDate.spec.ts \
  tests/unit/tripStops.spec.ts

# Full unit suite (incl. existing schema/backup round-trip: old file still valid)
pnpm exec vitest run

# E2E: composer flow, live distance, back-from-airport, offline zero-egress, a11y
pnpm exec playwright test trip-reconstruction a11y smoke
```

**Expected**: all green; the a11y run passes WCAG 2.1 AA on the composer; the offline run records
zero outbound requests for the trip flow.

## Manual walkthrough

### US1 + US2 — build a multi-stop trip and see the distance
1. Open the **Trips** tab → tap **New trip** (the multi-stop composer page opens full-screen).
2. Add stops in order — search and pick airports/cities (e.g. `CDG` → `Tokyo` → `Osaka`); each
   appears as an ordered row.
3. Reorder a stop (up/down buttons — keyboard `Enter`/`Space`) and remove one; confirm the order
   updates and the **total km** recomputes immediately.
4. Give the trip a **name** and a **rough date** (a year like `2024`, or a month like `2024-08`).
5. **Save** → the composer closes and the trip appears in the Trips list as one multi-stop journey
   with its distance; the Travel **totals** (trip count, total km) include it.
6. Reopen the trip → the same stops/name/date are restored; edit and re-save.

### US3 — Back from an airport returns to the Travel list
1. On the Trips tab, scroll to the **most-visited airports** roll-up and tap an airport.
2. The airport's **detail page** opens (not a map dead-end).
3. Press **Back** (and separately **Escape**, and the Android back gesture) **once** → you are
   returned to the **Trips list** where you were. The app never exits; you are never stranded on
   the map.

### Offline
1. Disable the network (DevTools offline / airplane mode).
2. Repeat US1–US3: search stops, compute distance, save, reopen, navigate — **all work**; no
   request is attempted.

### Backward compatibility
1. Import a portable file exported **before** this feature (or an existing single-leg trip): it
   loads unchanged and still shows its `from → to` distance.
2. Export after adding a multi-stop trip → re-import → no loss; files without `stops` never gain the
   key.

## Success signals (map to Success Criteria)
- Multi-stop trip built + distance shown, fully offline, in <90s (SC-001, SC-005).
- Total = Σ great-circle legs within tolerance; live recompute on edit (SC-002, SC-004).
- One Back from a Travel airport returns to the list, app never exits (SC-003).
- Pre-feature files + existing single-leg trips still load and display (SC-006).
- Composer passes axe WCAG 2.1 AA; build fails on any missing en/fr/ko key (SC-007).
