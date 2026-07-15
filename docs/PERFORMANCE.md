# Performance pass — owner's hand-check document

This documents the optimization pass applied to the working tree on **2026-07-15** (branch
`claude/monument-display-optimize-x1j6le`, 14 modified files + 1 new file, all under
`apps/postcards/`). Everything below is grounded in the actual diff. Verification already done
mechanically: `pnpm typecheck` clean, full unit suite 168/168 (including search/airports/journal/
visits/backup/schema specs against the real 135k-row gazetteer), production build succeeds with
the code split intact. What is NOT machine-checkable is how the app *feels* on your phone — that
is section 1.

Complementary reading: `docs/ALGORITHMS.md` explains the underlying algorithms; note its sections
2.2/2.3 now describe the *old* search early-exit conditions (see section 4 below).

---

## 1. How to check this by hand

Numbers match the entries in section 2. "DevTools" means remote-debugging the phone (chrome://inspect)
or checking the same behavior in a desktop browser with CPU throttling (4–6x) and the Network tab.

### 1.1 Startup: reference data downloads in parallel with the app bundle

1. DevTools → Application → Service Workers → Unregister; Network tab → "Disable cache"; reload.
2. In the Network waterfall, `reference/cities.json`, `airports.json`, `subdivisions.json`,
   `heritage.json` and `basemap/countries-50m.json` should start at time ~0, alongside the JS
   bundle — not in a second wave after the bundle finishes evaluating.
3. Feel: on a cold load over slow network, the time from tap-icon to first screen shrinks by
   roughly the reference-data download time (it used to be serial after ~400 kB of JS).

### 1.2 Startup: the Map tab opens without a chunk-download wait

1. Same cold-load setup. In the Network tab, watch for `MapScreen-*.js` (~1 MB): it should start
   downloading during boot, before you ever tap the Map tab.
2. As soon as the app renders, tap the Map tab. It should open without the former
   spinner/blank beat while the chunk downloaded.

### 1.3 Search: typing stays smooth, input echoes instantly

1. Wait ~10 s after launch (so the full 135k gazetteer has landed), open the place search on the
   Map screen, and type a fast burst like `xyzabc` then delete it and type `paris`.
2. Every keystroke should appear in the input instantly; the result list may lag one frame behind —
   that is the deferral working (1.3a). Rare queries (few big-city matches) no longer cost a
   full-array scan per bucket (1.3b) — with DevTools Performance recording, no long `searchPlaces`
   tasks should appear under keystrokes.
3. Same check in the Travel log's place picker (trip From/To fields).

### 1.4 Places lists: one toggle re-renders one row; Countries view is paged

1. Places → Visited with a long list: tap a ★ on one row. With React DevTools "Highlight updates
   when components render" on, only that row should flash, not the whole list (photo thumbnails
   included).
2. Places → Countries: the list now shows 100 rows with a "Showing 100 of 250 / Show 100 more"
   pager (head label says "250 countries"). Your visited countries sort first, so page one is
   yours.
3. Type in the country filter box — it should keep up with your typing (it used to reconcile all
   250 rows plus their toggle buttons per keystroke).

### 1.5 Journal: typing no longer writes to disk per keystroke

1. Journal → New story → type a fast sentence. Keystrokes should render with no hitching.
2. DevTools → Application → Local Storage: the draft key updates only after a ~400 ms pause in
   typing, not on every character.
3. Safety check: type a few words, immediately background the app (or switch tabs), reopen —
   the draft must contain everything, including the last burst. Same after Escape/Cancel.

### 1.6 Toggling a place with many visits logged stays instant

1. Needs a store with hundreds of visits (import a big backup). Open Places → Countries or a
   city page with `StateToggles` visible and toggle ⚑/✓ quickly.
2. The chip should flip with no perceptible delay. Previously every mounted per-place row paid a
   linear scan over all visits on every store change; lookups are now O(1) through a shared index.

### 1.7 The map no longer builds the 135k-dot Towns field you can't see

1. Fresh session, Towns toggle OFF (the default): open the Map tab with DevTools Performance
   recording. There should be no multi-hundred-ms task building/serializing the `cities-all`
   source after map load.
2. Toggle Towns ON: expect a one-time beat (~300–800 ms on a phone) while the dot field builds,
   then dots appear. Toggle OFF and ON again: instant — the field is kept, not rebuilt.

### 1.8 Editing notes/photos/dates no longer re-tiles the map markers

1. Open the map, then edit a visited place's note or a photo caption (map stays mounted in the
   background — it is never unmounted).
2. With Performance recording, there should be no GeoJSON `setData`/worker activity for the
   `cities`/`wishlist`/`airports` sources during the edit. Toggling visited status or ★ must
   still update the flag pill immediately (those ARE in the change-key).

### 1.9 World-zoom panning in All mode skips hidden POI rebuilds

1. Map in All mode, zoomed way out (whole continents visible — below zoom 4.5): pan repeatedly.
   Monument/airport markers are not visible at this zoom, and now the per-moveend rebuild of
   those two sources is skipped too (no `setData` in the profile).
2. Zoom in past ~z5 over Europe: monument badges and airport dots should populate at the end of
   the zoom gesture (moveend) — a slight difference from before, when stale data could show
   mid-animation.

### 1.10 Multi-photo pick lands in one write

1. On a visit, add 5–10 photos in one picker session.
2. The gallery should appear all at once after downscaling, noticeably faster than the old
   one-write-per-photo behavior (each write re-put the whole multi-MB record to IndexedDB).
3. Regression check: with a nearly full gallery (cap 48), a too-big pick still adds only what
   fits and toasts "Added N — the gallery is now full."

### 1.11 Undo restores one record and no longer wipes concurrent edits

1. Remove a visited place (Places row, search chip, or ✓ toggle) → toast appears. Before tapping
   Undo, toggle some *other* place visited. Tap Undo.
2. The removed place comes back with its photos/notes, and the other change you made **survives**
   (previously undo rewrote the whole table from a snapshot, discarding it). Same for photo-remove
   undo in the gallery.

### 1.12 Export/Import machinery loads on demand, not at boot

1. Cold load with the Network tab open: no `models-*.js` chunk should be fetched during startup.
2. Settings → Export JSON (or Import): now `models-*.js` (~68 kB) plus a tiny codec chunk appear,
   then the download/import proceeds as before. First click pays a one-time fetch beat; offline
   it comes from the SW precache.
3. The startup JS chunk is ~15% smaller (~382 kB from ~449 kB) — visible as `index-*.js` size in
   the Network tab.

---

## 2. What was optimized in this pass

### 2.1 Preload the render-blocking reference JSONs (startup waterfall)

- **Symptom:** long blank boot on cold loads; network idle while the JS bundle parses, then a
  second serial wave of JSON fetches.
- **Root cause:** `apps/postcards/src/main.tsx` gates the first render on `initReferenceData()`,
  whose seven fetches can only start after the bundle downloads and evaluates
  (`apps/postcards/src/lib/reference/referenceData.ts`, `initReferenceData`).
- **Change:** five `<link rel="preload" as="fetch" crossorigin>` hints in
  `apps/postcards/index.html:21-25` for the four heaviest render-blocking JSONs plus
  `basemap/countries-50m.json` (needed by the map immediately after). `%BASE_URL%` is substituted
  by Vite (verified in `dist/index.html`); `crossorigin` matches `fetch()`'s default credentials
  mode so the preloaded response is actually consumed.
- **Expected effect:** reference data downloads overlap bundle download/eval on first visit;
  repeat visits resolve from the SW cache and the hints cost nothing.

### 2.2 Warm the MapScreen/MapLibre chunk during boot

- **Symptom:** first tap on the Map tab (the default destination) stalled on a ~1 MB chunk
  download.
- **Root cause:** `MapScreen` is `React.lazy` (deliberately, to keep MapLibre out of the boot
  chunk), so nothing fetched it until the tab was opened.
- **Change:** `void import("./features/map/MapScreen")` fired after the
  `initReferenceData().then(render)` statement (`apps/postcards/src/main.tsx:27`). Vite dedupes
  dynamic imports by URL, so `React.lazy` resolves from the same in-flight request; the build
  confirms `MapScreen-*.js` (1,084 kB) stays a separate chunk.
- **Expected effect:** the chunk downloads in parallel with reference data; the Map tab opens
  immediately. Startup chunk size unchanged.

### 2.3 Search scan early-exits (cities + airports)

- **Symptom:** worst-case keystrokes scanned all ~135k city rows even after the result was
  already decided.
- **Root cause:** `searchCities` only broke when *both* buckets were full — but on the
  population-descending array the first `limit` prefix hits already ARE the result; no contains
  row can displace them. `searchAirports` had no early exit at all.
- **Change:** `apps/postcards/src/lib/reference/referenceData.ts:245-259` — `searchCities` breaks
  as soon as the prefix bucket holds `limit` rows, and the contains bucket stops growing at
  `limit`. `referenceData.ts:261-282` — `searchAirports` caps both name buckets at `limit` and
  breaks once the prefix bucket is full for queries that can never IATA-match (length not 2 or 3;
  only those can hit a 3-letter code). Output is provably identical to the old
  `[...buckets].slice(0, limit)`; pinned by `search.spec.ts` / `airports.spec.ts`.
- **Expected effect:** common queries (prefix of a big city) touch only the top of the array;
  worst cases bounded tighter. Combined with 2.6 the cost also leaves the keystroke render.

### 2.4 Places screen: paging, row memoization, filter memoization

- **Symptom:** the Countries checklist reconciled 250 rows (each with three toggle buttons) per
  keystroke of the filter; toggling one visit re-rendered every visible row including photo
  thumbnails; each list view ran its filter three times per render.
- **Root cause:** `apps/postcards/src/features/visits/PlacesScreen.tsx` — unpaged
  `countryRows.map(...)`, a plain function component `VisitRow`, and `filterVisits(list)` called
  in the slice and both length checks.
- **Change (all in `PlacesScreen.tsx`):** (a) Countries view renders `countryRows.slice(0, shown)`
  with the same "Show 100 more" pager as the other views (`PlacesScreen.tsx:537,571-580`);
  visited-first sort keeps your countries on page one; head label changed from "shown" to
  "countries" so it doesn't contradict the pager. (b) `VisitRow` wrapped in `React.memo`
  (`PlacesScreen.tsx:66`) — store updates keep untouched visit identities, so one toggle
  re-renders one row. (c) `filterVisits` is a `useCallback([q, year])` feeding three `useMemo`'d
  lists (`visitedShown`/`favoritesShown`/`wishlistShown`, `PlacesScreen.tsx:213-226`).
- **Expected effect:** country-filter typing and per-row toggles scale with what's on screen
  (≤100 rows), not the dataset.

### 2.5 Journal: draft mirror debounced off the keystroke path

- **Symptom:** typing in the story composer stuttered on slow devices.
- **Root cause:** a synchronous `localStorage.setItem` of the whole draft (title + full text) ran
  in an effect on every keystroke (`apps/postcards/src/features/journal/JournalScreen.tsx`,
  the draft-mirror effect).
- **Change:** `JournalScreen.tsx:462-503` — keystrokes update a `pendingDraft` ref; a 400 ms
  trailing debounce performs the write. `flushDraft()` runs on every path that could otherwise
  lose the tail of the burst: `visibilitychange`→hidden, `pagehide`, screen unmount, and inside
  `resetForm` (`JournalScreen.tsx:365`) so Escape/Cancel keeps the existing "never loses writing"
  contract. `clearDraft()` on submit is unchanged. The flush listeners live in a separate
  mount-lifetime effect — flushing in the debounce effect's own cleanup would run per keystroke
  and defeat the debounce.
- **Expected effect:** typing costs a ref write per keystroke; storage is touched at most every
  400 ms and at exit points.

### 2.6 Search rendering: defer the scan off the keystroke render

- **Symptom:** even with capped scans (2.3), the search fan-out + re-rank ran synchronously in the
  same render as the input echo.
- **Root cause:** `results = useMemo(() => searchPlaces(ref, q), [ref, q])` keyed directly on the
  controlled input value in both `apps/postcards/src/features/visits/PlaceSearch.tsx` and
  `apps/postcards/src/features/travel/PlacePicker.tsx`.
- **Change:** `dq = useDeferredValue(q)` keys the results memo (`PlaceSearch.tsx:39`,
  `PlacePicker.tsx:29`); the scan runs in an interruptible follow-up render that React drops if
  the next keystroke lands first. In `PlaceSearch`, `notFound` and everything hanging off it
  (sr-only announcement, empty-state text, `AddPlaceForm` seed) key on `dq` so the add-place form
  never flashes against a not-yet-scanned query; when idle `dq === q`, so settled behavior is
  identical. `PlacePicker`'s `open` still requires `q.trim().length >= 1`, so clearing the input
  closes the listbox instantly.
- **Expected effect:** input paints at native speed; results lag at most a frame under load.

### 2.7 O(1) visit lookups via a shared, identity-cached index

- **Symptom:** with hundreds of visits and many mounted per-place rows, every store change cost
  (rows × visits) linear scans — Zustand re-runs every subscribed selector on every `set()`.
- **Root cause:** `StateToggles`' subscription selector and `PlaceSearch`'s per-result-row lookup
  both used `findByPlace(visits, place)` — a `list.find` per row per store change
  (`apps/postcards/src/lib/store/useVisits.ts`, `findByPlace`).
- **Change:** `visitIndex(list)` in `useVisits.ts:35` — a `Map<placeKey, Visit>` cached in a
  `WeakMap` keyed on the visits array identity (valid because every store `set()` replaces the
  array immutably; superseded indexes are GC'd with their arrays). Consumers:
  `apps/postcards/src/features/visits/StateToggles.tsx` (subscription selector — returned record
  identities unchanged, so re-render behavior is identical) and `PlaceSearch.tsx:143` (result-row
  visited chip). One-off `findByPlace` calls in event handlers (cold paths) were left alone.
- **Expected effect:** each store change costs one O(n) index build then O(1) per mounted row,
  instead of O(n) per row.

### 2.8 Towns dot field: never built while hidden

- **Symptom:** every session paid a 300–800 ms build (135k Point features allocated + the whole
  collection serialized to MapLibre's worker) for the `cities-all` towns layer — which is hidden
  unless the off-by-default Towns toggle is on.
- **Root cause:** `applyAllCityDots` ran unconditionally at map-load idle and again when the
  gazetteer upgrade landed (`apps/postcards/src/features/map/MapView.tsx`).
- **Change:** `MapView.tsx:607-625` — `dotsGenRef` records the gazetteer generation the field was
  built at (−1 = never); `applyAllCityDots` returns early when `!showTownsRef.current` or the
  field is already current. The `[mode, showTowns, maxMarkers]` effect now also calls it
  (`MapView.tsx:1195`) so the first toggle-on builds the field; the load-handler idle call and the
  gazGen effect self-gate through the same guards. Deliberate deviation: no `setData(EMPTY_FC)`
  on toggle-off — clearing would make every re-toggle repay the build; a field built at an older
  generation is refreshed lazily on the next toggle-on rather than rebuilt while hidden.
- **Expected effect:** sessions that never touch Towns (most) never pay the build; Towns users pay
  once per session per gazetteer generation.

### 2.9 Personal marker sources: key-guarded `setData`

- **Symptom:** any visits-store change — a note edit, a photo caption, a date — re-built and
  re-shipped all three personal GeoJSON sources (`cities`, `wishlist`, `airports`) to MapLibre's
  worker (build + serialize + re-index + repaint), even while the map was hidden (it stays mounted
  for the app's life).
- **Root cause:** `applyVisited` unconditionally called `setData` on all three sources on every
  visits change (`MapView.tsx`, applyVisited).
- **Change:** `MapView.tsx:728-780` — per-source change-keys computed from exactly what the
  builders in `apps/postcards/src/features/map/visitedLayers.ts` read (`kind:id:status:favorite`
  for cities/custom and airports; city ids for wishlist), held in refs sentinel-initialized to
  `"<init>"` so the first apply always draws. `setData` is skipped when the key is unchanged. The
  gazGen effect (`MapView.tsx:1160-1169`) resets the keys to the sentinel so the full-gazetteer
  upgrade still re-resolves markers for small towns that only exist in the full set.
- **Expected effect:** note/photo/date edits cost three string-key computations and zero map work;
  status/favorite changes still repaint immediately.

### 2.10 Viewport POI pipeline: zoom gates, empty-once, sort → single-pass partition

- **Symptom:** every camera stop (including programmatic ones) rebuilt the monuments and
  browsable-airports sources even at world zoom in All mode, where the layers render nothing
  (applyMode gates them to z≥4.5 / z≥5); hidden branches also re-posted an empty collection to the
  worker on every stop; visible branches paid a full `sort()` just to move "seen" places first.
- **Root cause:** `MapView.tsx`, `applyViewportPoi` — mode-only branch conditions, unconditional
  `setData(EMPTY_FC)` on the else branch, and `inView.sort(...)` on every rebuild.
- **Change:** `MapView.tsx:641-718` — All-mode branches require the same zoom thresholds
  applyMode enforces; `monEmptyRef`/`airEmptyRef` send `EMPTY_FC` at most once until data returns;
  the seen-first ordering is a single-pass stable two-bucket partition folded into the viewport
  filter (identical output order, no O(n log n) sort).
- **Expected effect:** world-zoom panning in All mode skips both rebuilds entirely; visible
  rebuilds are cheaper. Visible micro-difference: at world zoom the sources hold EMPTY instead of
  invisible stale data, so after crossing the zoom gate markers appear at moveend rather than
  mid-zoom-animation.

### 2.11 Photos: batch `addPhotos`, single-record writes

- **Symptom:** picking N photos performed N sequential store updates and N IndexedDB `putVisit`
  calls — each re-serializing the entire (multi-MB, photos-inline) visit record.
- **Root cause:** `PhotoGallery.onPick` awaited `addPhoto` once per file
  (`apps/postcards/src/features/visits/PhotoGallery.tsx`); the store only exposed single-photo
  append (`useVisits.ts`, addPhoto).
- **Change:** `useVisits.ts:151` — `addPhotos(visitId, photos)`: one concat respecting
  `MAX_PHOTOS_PER_VISIT`, one `set()`, exactly one `db.putVisit`; `addPhoto` delegates to it.
  `PhotoGallery.tsx` downscales all picked files into a local `Photo[]`, then makes one
  `addPhotos` call. Known micro-difference (error path only): a decode failure now voids the
  whole pick instead of keeping earlier files.
- **Expected effect:** a 10-photo pick costs 1 record write instead of 10; less UI-thread jank
  from IndexedDB serialization during the busy state.

### 2.12 Undo: single-record `restoreVisit` instead of whole-table `setAll`

- **Symptom:** every undo toast (remove place, remove photo) snapshotted the entire visits array
  up-front and, on undo, cleared and rewrote the whole IndexedDB visits table — O(total data,
  photos included) for a one-record operation — and silently discarded any unrelated edits made
  while the toast was up.
- **Root cause:** four call sites captured `useVisits.getState().visits` and undid via
  `setAll(prev)`: `StateToggles.onBeen`, `PlaceSearch.toggle`, `PlacesScreen` VisitRow
  `removeWithUndo`, `PhotoGallery` photo-remove.
- **Change:** `useVisits.ts:194` — `restoreVisit(visit)`: upsert into state by `visitId` plus a
  single `db.putVisit`. The four call sites now snapshot only the affected record before the
  mutation. `setAll` is kept for import/multi-record restores. Restored records append at the
  array end — invisible, because every consumer sorts or does keyed lookups. Known edge: remove →
  re-add the same place → undo creates two records for the place (same `(kind,id)`, different
  `visitId`), bounded by the toast lifetime; the old snapshot behavior had an analogous
  imperfection (it discarded the re-add entirely).
- **Expected effect:** undo is O(1 record); unrelated edits made during the toast now survive.

### 2.13 Bundle diet: zod out of the boot chunk

- **Symptom:** ~68 kB min (18 kB gz) of zod + schema definitions were parsed and evaluated at
  startup, though the only runtime users of the schemas are the Export/Import codecs.
- **Root cause:** startup-loaded modules imported runtime *values* (`placeKey`,
  `normalizeVisitPhotos`, `MAX_PHOTOS_*`) from `apps/postcards/src/lib/schema/models.ts`, which
  imports zod at the top; `Backup.tsx` statically imported both codecs.
- **Change:** new zod-free `apps/postcards/src/lib/schema/helpers.ts` holds the constants and
  helpers; `models.ts` imports them and re-exports everything (every existing import path stays
  valid; moved code is byte-identical). Runtime-value imports repointed at `helpers.ts` in six
  statically-loaded files — the four planned (`useVisits.ts`, `CityScreen.tsx`,
  `PhotoGallery.tsx`, `JournalScreen.tsx`) plus `PlaceSearch.tsx` and `StateToggles.tsx`, which a
  repo-wide grep showed also import `placeKey` as a value (leaving them would have kept zod in
  the startup chunk). Type-only imports still point at `models.ts` (erased at compile). In
  `apps/postcards/src/features/backup/Backup.tsx:57,77`, the codecs are `await import(...)`'d on
  click (inside the existing try, so a failed chunk fetch reuses the existing error message).
- **Expected effect (measured in the prod build):** startup chunk 382 kB (from ~449 kB, ~15%);
  zod lands in lazy `models-*.js` (68.16 kB min / 18.37 kB gz) plus tiny `exportJson-*.js`
  (0.60 kB) / `importJson-*.js` (1.65 kB), fetched on first Export/Import click; grep confirms 0
  zod markers in `index-*.js`.

---

## 3. The performance model of the app

Every hot path, with its current cost drivers after this pass. n = visit count, typically ≤ a few
hundred; gazetteer = 24k rows before the idle upgrade, ~135k after.

| Hot path | Trigger | Current cost drivers | Where |
|---|---|---|---|
| Cold start (first visit) | app open, empty caches | boot chunk ~382 kB download+eval, in parallel with 5 preloaded JSONs (2.1) and the 1,084 kB MapScreen chunk (2.2); core gazetteer (~3.1 MB) parse + index build + fold/sort on the main thread before first render; SW precache (~6.7 MB) in background | `apps/postcards/index.html`, `src/main.tsx`, `src/lib/reference/referenceData.ts` |
| Warm start | app open, SW populated | same minus network; core gazetteer JSON parse + index build remains the dominant main-thread block before first render | `src/lib/reference/referenceData.ts` |
| Idle after start | ~first idle | 17 MB `cities-all.json` fetch (CacheFirst after first run) + parse/fold/sort in a Web Worker; main-thread swap = 135k-entry `cityIndex` rebuild + per-country recounts; gazGen bump re-runs subscribed memos (stats, map markers — marker keys reset then recomputed once, 2.9) | `src/lib/reference/referenceData.ts`, `gazetteerWorker.ts`, `src/features/map/MapView.tsx` |
| First Map open | tap Map tab | chunk already warm (2.2); MapLibre style assembly pre-`new Map`; countries-50m TopoJSON decode (module-cached); personal marker builds O(n); marker icons rasterized lazily per variant; towns field NOT built unless toggle on (2.8) | `src/features/map/MapView.tsx`, `MapScreen.tsx` |
| Pan/zoom end (user) | `moveend` | `citiesInView` linear filter over gazetteer, capped 2000 + presorted early-exit; `applyViewportPoi` heritage+airport single-pass partition, only past mode/zoom gates (2.10); in-view list re-render (30 rows paged); viewport-ring tile prefetch | `src/features/map/viewport.ts`, `MapView.tsx`, `MapScreen.tsx` |
| Live pan | pointer drag | MapLibre GPU render; bounds emission throttled 150 ms; no JS dataset work until moveend | `MapView.tsx` |
| Type (place search / trip picker) | keystroke | input re-render only; deferred render (2.6) runs `searchPlaces` fan-out — cities break-capped (2.3), airports capped/full-scan only for 2–3-char queries, countries+heritage small full scans — then re-rank of ≤32 rows; per-row visited chip O(1) via `visitIndex` (2.7) | `src/features/visits/PlaceSearch.tsx`, `search.ts`, `src/lib/reference/referenceData.ts`, `src/features/travel/PlacePicker.tsx` |
| Type (journal composer) | keystroke | controlled input re-render + ref write; localStorage write debounced 400 ms with flush on hide/unmount/cancel (2.5) | `src/features/journal/JournalScreen.tsx` |
| Type (Places filter) | keystroke | memoized `filterVisits` over the loaded lists O(n); ≤100 rows reconciled (memoized rows skip) (2.4) | `src/features/visits/PlacesScreen.tsx` |
| Toggle visited/wish/★ (tap) | chip/button | `dedupeUpsert` O(n) + one `db.putVisit`; Zustand notifies all selectors — one O(n) `visitIndex` build then O(1) per mounted row (2.7); memoized rows re-render only the changed one (2.4); map: 3 change-key computations O(n log n) on small filtered arrays, `setData` only for the changed source (2.9), choropleth key check | `src/lib/store/useVisits.ts`, `StateToggles.tsx`, `MapView.tsx` |
| Remove + undo | row ✕ / toast | remove: O(n) filter + one db delete; undo: one `restoreVisit` upsert + one `putVisit` (2.12) | `src/lib/store/useVisits.ts` |
| Add photos | picker | canvas downscale per file (unavoidable, async); ONE store write + ONE `putVisit` for the whole pick (2.11); record re-serialization is O(record size) | `src/features/visits/PhotoGallery.tsx`, `src/lib/store/useVisits.ts` |
| Towns toggle-on | map toolbar | one-time 135k-feature build + worker serialize (~300–800 ms), cached per gazetteer generation (2.8) | `src/features/map/MapView.tsx` |
| Tab switch to Map | nav tap | CSS `display` flip only (map is keep-alive, never unmounted); stat strip + list re-mount | `src/app/App.tsx`, `MapScreen.tsx` |
| Export / Import | Settings tap | first use: lazy fetch of `models-*.js` + codec chunk (2.13); then Zod validate/serialize O(data), photos inline | `src/features/backup/Backup.tsx`, `exportJson.ts`, `importJson.ts` |

---

## 4. Known remaining costs / not done on purpose

- **Core gazetteer parse blocks first render (~3.1 MB JSON, 24k rows).** It is the deliberate
  startup gate (`docs/ALGORITHMS.md` §1.1): every screen assumes `getReferenceData()` succeeds
  synchronously. Moving it to a worker would still gate first render on the same work plus a
  postMessage copy. The preloads (2.1) attack the network half; the parse half stands.
- **MapScreen chunk is 1,084 kB, mostly MapLibre.** Warmed (2.2), not shrunk. A lighter map
  library would be a new dependency — barred by the constitution. Not actionable in-repo.
- **`searchCities` still scans all ~135k rows for queries with fewer than 8 prefix hits.** The
  break requires the prefix bucket to fill; with fewer hits, a later prefix match must still be
  found, so the full scan is required for correctness. Cost is off the keystroke render via
  `useDeferredValue` (2.6). Same for 2–3-character airport queries (IATA can match anywhere in
  the array), but that dataset is small.
- **`removePhoto` / `setPhotoCaption` / `setDetails` still re-put the whole multi-MB record.**
  One write each (fine), but the write is O(record) because photos are inline data URLs in the
  visit record — a portable-file design decision (`docs/ALGORITHMS.md` §6.4). Splitting photos
  into their own IndexedDB store would be a db/schema migration; out of scope for this pass.
- **`applyVisited` computes three change-keys (filter+map+sort over visits) on every visits
  change** (2.9). O(n log n) on visit count — trivially cheap next to the skipped `setData`, but
  it is new per-change work; revisit if visit counts reach many thousands.
- **Towns first toggle-on still costs the full 300–800 ms build** (2.8). Deferred, not
  eliminated; building it pre-emptively is exactly what was removed. The optional clear-on-
  toggle-off was deliberately rejected — it would make every re-toggle repay the build.
- **Journal debounce can lose up to 400 ms of typing on a hard process kill.** Backgrounding,
  tab-switching, cancel, and unmount all flush (2.5); only an outright crash inside the window
  loses the tail. Accepted trade for smooth typing.
- **Undo duplicate edge (2.12):** remove → re-add the same place → undo yields two records for
  one place until the next dedupe-touching write. Bounded by the toast lifetime; the previous
  whole-table snapshot had the complementary flaw (discarding the re-add).
- **Multi-photo pick is all-or-nothing on a decode error (2.11).** Previously files decoded
  before the failure survived. Error path only.
- **World-zoom All-mode: monuments/airports appear at moveend after crossing the zoom gate**
  instead of mid-zoom-animation (2.10) — the sources hold EMPTY rather than invisible stale data.
- **Three small reference JSONs are not preloaded** (`landmarks.json`, `languages.json`,
  `article-names.json`) — the hint list was kept to the large render-blockers; these are small
  and optional (empty-array fallbacks).
- **`docs/ALGORITHMS.md` §2.2/§2.3 now describe the old search early-exit conditions.** That doc
  says to trust code over doc; refresh it in a follow-up change set per its §7 rule.
- **No e2e test pins the changed surfaces.** The unit suite (168/168), typecheck, and a prod
  build were verified; the only Countries-checklist e2e filters to "Japan" before asserting, and
  visited countries sort to page one, so the new pager doesn't break it — but nothing e2e-tests
  the pager, the deferral, or the undo semantics directly.
- **`dist/` was regenerated (untracked)** as a side effect of build verification in this pass.
