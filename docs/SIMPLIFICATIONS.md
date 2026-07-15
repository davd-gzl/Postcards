# Simplifications

A quality-only pass over the Postcards app: dead code removed, copy-pasted
logic unified into single helpers, and a few convoluted spots straightened out.
Zero behavior change, no schema/security/accessibility/performance regressions,
no new dependencies. All 168 unit tests and 22 e2e tests remain unchanged and
passing.

## 1. Summary

- **Net lines removed:** ~137 (tracked files: 129 added / 314 removed = −185;
  plus 48 lines across 3 new shared-helper files → −137 overall).
- **Files touched:** 26 — 23 existing files modified, 3 new files added.
- **Files deleted:** 0. (Several *local* function copies were deleted, but every
  affected file still has other content; no whole file was removed.)
- **Files added (3):**
  - `apps/postcards/src/lib/store/uuid.ts`
  - `apps/postcards/src/lib/download.ts`
  - `apps/postcards/src/ui/ListPager.tsx`

## 2. What was simplified

### Dead code removed

- **Unused `monumentPoints` map layer** — `apps/postcards/src/features/map/visitedLayers.ts`.
  An exported function (plus its doc comment) that built a browsable UNESCO-heritage
  layer. Imported nowhere; the specs that use this module only touch
  `visitedCityPoints`/`tripArcs`/`airportPoints`. Deleted. No imports
  (`Feature`/`Point`/`FeatureCollection`/`Visit`) became unused.

- **Three dead icon components** — `apps/postcards/src/ui/icons.tsx`.
  `FlagIcon`, `MoreIcon`, and `SparkIcon` were exported but referenced only at
  their own definitions across all of `src` + tests. Deleted with their comments;
  the shared `common` props and the seven in-use icons stayed.

- **Dead `CONTINENTS` const + `Continent` type** — `apps/postcards/src/lib/reference/continents.ts`.
  Both were used only inside the file that defined them. Removed;
  `CONTINENT_COLORS`, `CONTINENT_FALLBACK`, and `continentColor` are untouched.

- **Four proven-dead CSS rule-sets** — `apps/postcards/src/styles.css`.
  `.cap-note`, `.guide-modal` (phone + 840px desktop variants + `.guide-modal .btn`),
  `.guide-summary` (+ `.guide-summary p`), and `.map-ghost` matched no element
  anywhere in the non-CSS source. Removed the standalone blocks and pruned the two
  grouped selectors (`.cap-note` off the `@container` list, `.guide-summary a` off
  the link group), keeping every still-used `.guide-*` sibling.

- **Unused `className` prop on `MoreButton`** — `apps/postcards/src/ui/MoreButton.tsx`.
  All seven call sites relied on the `"mini-btn"` default and never passed the prop.
  Dropped `className?: string` from the props type/destructure and hardcoded
  `className="mini-btn"` on the button.

- **Stale JSDoc block above `makeCityPill`** — `apps/postcards/src/features/map/MapView.tsx`.
  An inaccurate first comment (describing a pill with a gold ring and population
  label) preceded the accurate flag-emoji/corner-star block. Comment-only removal;
  the correct block remains.

- **No-op ternary in the Wikipedia link URL** — `apps/postcards/src/features/city/CityScreen.tsx`.
  `wikipediaUrl(country ? \`${name}\` : name)` → `wikipediaUrl(name)`; both
  branches produced the same string. `country` is still used elsewhere, so no
  unused-variable fallout.

- **Narrowed over-broad exports** — `buildFile` in
  `apps/postcards/src/features/backup/exportJson.ts` and `onlyVisited` in
  `apps/postcards/src/features/stats/computeStats.ts` lost their `export` keyword;
  every caller is in-file, so they are now module-private.

### Duplication unified

- **`uuid()` triplication → one module** — new `apps/postcards/src/lib/store/uuid.ts`.
  The identical `crypto.randomUUID` + non-secure regex fallback lived in
  `useVisits.ts`, `useTrips.ts`, and `useStories.ts`. Hoisted into one file and
  imported by all three; `todayISO()` in `useVisits.ts` left as-is.

- **`download()` helper duplicated → one module** — new `apps/postcards/src/lib/download.ts`.
  A byte-identical blob-download helper existed in
  `apps/postcards/src/features/backup/Backup.tsx` and
  `apps/postcards/src/features/journal/JournalScreen.tsx`. Both now import the
  shared version. `SettingsScreen`'s unrelated `download(r: OfflineRegion)` was
  left alone.

- **Six identical pager blocks → `ListPager`** — new `apps/postcards/src/ui/ListPager.tsx`.
  The "Showing X of Y / Show N more" footer was copy-pasted five times in
  `apps/postcards/src/features/visits/PlacesScreen.tsx` (step 100) and once in
  `apps/postcards/src/features/passport/PassportScreen.tsx` (step 60). Extracted a
  `ListPager({ shown, total, step, onMore })` that renders the exact same DOM; each
  call site keeps its `X.length > shown` guard. Both files swapped their
  `MoreButton` import for `ListPager` (it was used only by those pagers there).

- **Duplicated passport flag-card → `FlagCard`** — `apps/postcards/src/features/passport/PassportScreen.tsx`.
  The collected and locked-missing grids each hand-wrote the same
  `<li><button class="flag-card…">` markup. Folded into one local
  `FlagCard({ c, locked })` (`className={"flag-card" + (locked ? " flag-locked" : "")}`);
  `key` moved onto the `FlagCard` element, which now owns the `<li>`.

- **Travel-mode `ORDER`/`LABELS` scattered → `modes.ts`** — 
  `apps/postcards/src/features/travel/modes.ts` now owns `MODE_ORDER` and
  `MODE_LABEL` next to the existing `MODE_GLYPH`. `distance.ts` imports `MODE_ORDER`
  (local copy deleted), `exportMarkdown.ts` imports `MODE_LABEL` (local copy
  deleted), and `TravelScreen.tsx` derives its form list via
  `MODE_ORDER.map((value) => ({ value, label: MODE_LABEL[value] }))` instead of a
  hardcoded array. No import cycle — `modes.ts` imports only the `TravelMode` type.

- **`storyYears` reuses `tripYears`' algorithm → `distinctYearsDesc`** —
  `apps/postcards/src/features/travel/period.ts`. Added
  `distinctYearsDesc(items: { date: string | null }[])` (Set of `date.slice(0,4)`,
  sorted descending). `tripYears` delegates to it, and
  `apps/postcards/src/features/journal/JournalScreen.tsx`'s `storyYears` `useMemo`
  now calls it too, dropping its own hand-rolled copy.

### Complexity reduced

- **Eight `localStorage` try/catch wrappers → two helpers** —
  `apps/postcards/src/lib/store/useSettings.ts`. Collapsed the repeated
  read-and-swallow / write-and-swallow boilerplate into module-local
  `readLocal(key)` and `writeLocal(key, value)`. All four loaders and four setters
  now route through them. Same keys, same swallowed exceptions, same defaults
  (`Number(null) = 0` still falls to `DEFAULT_MAX_MARKERS`; `null !== "0"` still
  yields `true` for the boolean toggles).

- **Duplicated dialog-layer selector string → one constant** —
  `apps/postcards/src/app/App.tsx`. The
  `.modal-backdrop, .lightbox, .maplibregl-popup, .journal-composer-busy`
  querySelector string appeared verbatim in both the Escape keydown handler and the
  popstate handler. Hoisted to a module-level `DIALOG_LAYER_SELECTOR` (byte-identical
  to the originals) referenced from both.

## 3. Behavior-preservation note

No test file was changed. After the pass, `tsc --noEmit` is clean and the full
unit suite passes unchanged (24 files, 168 tests); the 22 e2e tests are likewise
untouched. Every edit is a like-for-like refactor: shared helpers reproduce the
same DOM/values, narrowed exports keep all callers in-file, and removed code was
verified unreferenced before deletion.

Deliberately left alone:

- **`todayISO()` in `useVisits.ts`** — not duplicated elsewhere, so it stayed
  local rather than being pulled into the shared `uuid.ts`.
- **`SettingsScreen`'s `download(r: OfflineRegion)`** — a different signature and
  purpose from the blob helper; not merged.
- **Other feature pagers** (CountryScreen, JournalScreen, MapScreen) — they use
  different wording/formatting (e.g. `formatInt`) than the six unified ones, so
  they were not forced into `ListPager`.
- **`ListPager` micro-difference** — `MoreButton`'s children go from one trimmed
  string node to `Show {step} more` (three nodes), but serialized `textContent`
  is identical (`"Show 100 more"` / `"Show 60 more"`) and no test queries pager
  text or DOM.
- **Retained type imports** — `TravelMode` in `distance.ts` and `Trip` in
  `exportMarkdown.ts` stayed after their local consts moved out, because other
  code in each file still uses them.
