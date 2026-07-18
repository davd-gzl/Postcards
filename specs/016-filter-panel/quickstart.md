# Quickstart — Unified Filter Panel (validation)

How to prove the feature works end-to-end. Run from `apps/postcards`.

## Prerequisites

- `npm ci` (deps already vendored in the repo).
- Dev server: `npx vite` (or the e2e harness builds + previews on :4173).

## Automated checks

```bash
cd apps/postcards
npx tsc --noEmit                                   # types (i18n key parity enforced)
npx vitest run tests/unit/applyFilters.spec.ts     # pure predicate truth table (D3/D4)
npx vitest run tests/unit/filterState.spec.ts      # defaults / isDefault / activeChips / clear
npx playwright test filter-panel                   # open → apply → clear → shared state
npx playwright test a11y                           # WCAG 2.1 AA gate incl. open panel
```

## Manual validation scenarios (map to acceptance)

1. **US1 — one place to slice** (SC-001): On the Map, confirm the list header shows only
   the **Filter** button + search (no inline status/population/sort). Open Filter, set
   status = Want list, People = 1M+, year = 2024, close — the list + counters show exactly
   the matching cities.
2. **US1 #3 — single source of truth**: Reopen Filter — every control reflects the applied
   values.
3. **US2 — summary + clear** (SC-002): With filters active, a chip summary shows each one;
   tap a chip ✕ → only that dimension resets; **Clear all** → everything resets, summary
   empty.
4. **US3 — same everywhere**: Go to Places → Visited; the Filter reflects the same values
   and the list agrees; a population threshold hides only cities below it (airports/
   monuments remain) — identical to the map.
5. **US4 — extensible**: In the panel, enable **Favorites only**; both screens narrow to
   favourites, combinable with the other dimensions, with no new header button.
6. **Edge — no matches**: Set an impossible combination; the list shows a labelled empty
   state naming the active filters with Clear all.
7. **A11y / keyboard** (SC-004): Open and operate the whole panel by keyboard only; Escape
   closes and returns focus to the Filter button; axe reports no serious violations.
8. **Perf** (SC-003): With the full gazetteer loaded, toggling any dimension updates the
   list with no perceptible lag.

## Expected outcome

All automated checks green; every manual scenario behaves as described; the Map and
Places list headers carry a single Filter control (plus search) and nothing else.
