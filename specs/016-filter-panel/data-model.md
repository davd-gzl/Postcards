# Data Model — Unified Filter Panel

All entities are **in-memory UI/session state**, not part of the portable data file
(Principle IV). Nothing here changes the visit/reference schemas.

## FilterState

The single shared description of how the user's places are currently sliced.

| Field | Type | Default | Persisted | Applies to |
|-------|------|---------|-----------|------------|
| `status` | `"all" \| "visited" \| "wishlist" \| "unvisited"` | `"all"` | localStorage | all place kinds |
| `minPop` | `0 \| 10000 \| 100000 \| 1000000` | `0` | localStorage | cities only (D4) |
| `date` | `{mode:"all"} \| {mode:"undated"} \| {mode:"range",from,to}` | `{mode:"all"}` | session | dated records |
| `folder` | `string` (`""` = all) | `""` | session | your records |
| `sort` | `"pop" \| "az"` | `"pop"` | localStorage | list order |
| `mode` | `"all" \| "cities" \| "monuments" \| "airports"` | `"all"` | session | map marker kind |
| `favoritesOnly` | `boolean` | `false` | session | growth (US4) |
| `hasPhoto` | `boolean` | `false` | session | growth (US4) |
| `hasNote` | `boolean` | `false` | session | growth (US4) |
| `continent` | `string` (`""` = all) | `""` | session | growth (US4) |

**Invariants**
- Every field has a default; `isDefault(state)` is true iff every field equals its default
  (drives "no filters active" — empty summary, no Clear needed).
- `date.mode==="range"` implies `from`/`to` are ISO dates or `""`; a range with neither
  reconciles to `{mode:"all"}`.
- `folder` / `continent` reconcile to `""` if the referenced value no longer exists
  (edge case: deleted trips) — never a phantom selection.

**Derived**
- `activeChips(state, t)` → ordered `ActiveFilterChip[]` — one per non-default field.
- Reset helpers: `clearField(state, field)` and `clearAll()` → defaults.

## ActiveFilterChip

A human-readable, removable summary of one non-default dimension.

| Field | Type | Notes |
|-------|------|-------|
| `field` | keyof FilterState | which dimension this chip represents |
| `label` | string | localized, e.g. "Want list", "1M+", "2024", "📁 Japan" |
| `onRemove` | () => void | resets exactly `field` to its default |

## Predicate contract (applyFilters)

Pure functions, no side effects, no I/O:

- `cityPasses(city, state)` — status is resolved by the caller's visited/wishlist sets;
  `minPop` compares `city.population`; growth flags read the matching record.
- `placeMatches(visit, refData, state)` — for the Places list: composes status, date,
  folder, favoritesOnly, hasPhoto, hasNote, continent; `minPop` applies only when
  `visit.place.kind==="city"` (D4 — non-city kinds pass the population gate).
- `sortPlaces(list, state)` — `"pop"` (desc population, gazetteer order) or `"az"`
  (locale compare on name).

These are the same predicates the map's `viewport.ts` adapters and the Places list use,
so both screens agree (US3).
