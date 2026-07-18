# Contract — Shared Filter State & Predicates

The app's UI contract for the one filter surface. Screens depend on THIS, not on each
other's local state.

## Store: `useFilters`

```
state:  FilterState                     // see data-model.md
set(partial: Partial<FilterState>)      // shallow-merge one or more dimensions
clearField(field: keyof FilterState)    // reset exactly one dimension to default
clearAll()                              // reset every dimension to default
```

- Preference dimensions (`status`, `minPop`, `sort`) are hydrated from and written to
  `localStorage` (existing keys reused); session dimensions are in-memory only.
- `useFilters.getState()` is available to the map's imperative painters (no React
  round-trip), matching how the map already reads visits.

## Consumers (must all read the SAME state)

- **Map** (`MapView` markers + `MapScreen` in-view list + counter strip): `status`,
  `minPop`, `date`, `folder`, `mode`, `sort`, growth flags.
- **Places** (`PlacesScreen` Visited / Want list): `status`, `minPop`, `date`, `folder`,
  `favoritesOnly`, `hasPhoto`, `hasNote`, `continent`, `sort`.
- **Counters**: derive from the same predicates so "N in view / N visited" never disagree
  with the list.

## Predicate API (`lib/filter/applyFilters.ts`, pure)

```
placeMatches(visit, refData, state) -> boolean   // Places list membership
cityPasses(city, visitedSets, state) -> boolean  // map in-view city membership
sortPlaces(list, state) -> list                  // stable order per state.sort
activeChips(state, t) -> ActiveFilterChip[]       // summary
isDefault(state) -> boolean
```

**Rules**
- `minPop` gates cities only; non-city kinds pass it unchanged (D4).
- No predicate performs I/O or mutates input; deterministic for a given `(input, state)`.
- Adding a dimension = add a field (data-model) + one clause here + one panel section +
  one `activeChips` label. No screen header changes.
