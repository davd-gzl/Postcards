import type { City } from "../../lib/reference/types";

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
  /** Current map zoom, when known (used to pick tile levels for offline save). */
  zoom?: number;
}

/** Longitude membership that tolerates a viewport crossing the antimeridian. */
function lonInRange(lon: number, west: number, east: number): boolean {
  return west <= east ? lon >= west && lon <= east : lon >= west || lon <= east;
}

// --- Spatial grid index -----------------------------------------------------
// The gazetteer holds ~135k cities. Scanning ALL of them on every pan is the
// felt lag at city/region zoom (few match, so a population-ordered early-break
// still walks deep before it finds `limit`). Instead, bucket cities into a
// 1°×1° grid ONCE (rebuilt only when the gazetteer array changes — e.g. the
// 24k→135k upgrade) and, for a zoomed-in view, visit only the handful of cells
// the viewport covers. Wide views (many cells) fall back to the population-
// ordered early-break, which is already fast when the top cities are everywhere.
const GRID_COLS = 360;
// A zoomed-in view touches few cells → always use the grid (a cheap collect), no
// need to weigh density. ~1024 ≈ a 32°×32° window.
const CELL_MAX = 1024;
// Between CELL_MAX and here, weigh how many cities the covered cells actually hold
// (a cheap bucket-length sum, no per-city work) and use the grid when that's
// modest — so a WIDE but SPARSE view (ocean/desert/poles) skips empty cells
// instead of scanning all ~135k population-sorted rows to find fewer than `limit`
// in-view. Beyond this the view is near-global and cities are everywhere, so the
// population early-break wins outright.
const GRID_DENSITY_MAX = 16_384;
// The grid-collect path is worth it up to roughly this many candidate cities in
// the covered cells; above it a wide view is dense enough that the population-
// ordered early-break reaches the top `limit` faster.
const GRID_MAX_CANDIDATES = 20_000;

function clampRow(lat: number): number {
  return Math.min(179, Math.max(0, Math.floor(lat + 90)));
}
function wrapCol(lon: number): number {
  return (((Math.floor(lon + 180) % 360) + 360) % 360);
}

let gridCities: City[] | null = null;
let grid: Map<number, City[]> | null = null;

function ensureGrid(cities: City[]): Map<number, City[]> {
  if (grid && gridCities === cities) return grid;
  const g = new Map<number, City[]>();
  for (const c of cities) {
    const id = clampRow(c.lat) * GRID_COLS + wrapCol(c.lon);
    const bucket = g.get(id);
    if (bucket) bucket.push(c);
    else g.set(id, [c]);
  }
  grid = g;
  gridCities = cities;
  return g;
}

/** Number of 1°-columns a viewport spans, wrap-aware (0..360). */
function columnSpan(bounds: Bounds): { startCol: number; colCount: number } {
  const startCol = wrapCol(bounds.west);
  const endCol = wrapCol(bounds.east);
  const colCount =
    bounds.west <= bounds.east
      ? Math.min(360, Math.floor(bounds.east + 180) - Math.floor(bounds.west + 180) + 1)
      : Math.min(360, 360 - startCol + endCol + 1);
  return { startCol, colCount };
}

/**
 * Cities whose coordinates fall inside the current map viewport, sorted by
 * population (most people first). Powers the "cities in view" list that updates
 * as the user pans/zooms.
 *
 * `presorted: true` means `cities` is already population-descending (the bundled
 * gazetteer is) — it lets the wide-view fallback stop at the first `limit`
 * matches instead of re-sorting 135k rows on every move.
 */
export function citiesInView(
  cities: City[],
  bounds: Bounds | null,
  limit = 25,
  presorted = false,
): City[] {
  if (!bounds) return [];

  // Prefer the grid (collect only cities in the covered cells, skipping empty
  // ocean/desert cheaply) unless the view is wide AND dense, where the
  // population-ordered early-break reaches the top `limit` faster.
  if (Number.isFinite(limit)) {
    const g = ensureGrid(cities);
    const row0 = clampRow(bounds.south);
    const row1 = clampRow(bounds.north);
    const { startCol, colCount } = columnSpan(bounds);
    const cellCount = (row1 - row0 + 1) * colCount;

    let useGrid: boolean;
    if (cellCount <= CELL_MAX) {
      useGrid = true; // zoomed-in: few cells, always a cheap collect
    } else if (cellCount <= GRID_DENSITY_MAX) {
      // Weigh density cheaply: sum bucket lengths over the covered cells (Map.gets
      // only, no per-city work). A sparse wide view holds few cities → grid wins;
      // a dense one holds many → the early-break is faster.
      let covered = 0;
      for (let r = row0; r <= row1; r++) {
        for (let k = 0; k < colCount; k++) {
          covered += g.get(r * GRID_COLS + ((startCol + k) % 360))?.length ?? 0;
        }
      }
      useGrid = covered <= GRID_MAX_CANDIDATES;
    } else {
      useGrid = false; // near-global: cities everywhere, early-break wins
    }

    if (useGrid) {
      const candidates: City[] = [];
      for (let r = row0; r <= row1; r++) {
        for (let k = 0; k < colCount; k++) {
          const bucket = g.get(r * GRID_COLS + ((startCol + k) % 360));
          if (!bucket) continue;
          for (const c of bucket) {
            if (
              c.lat >= bounds.south &&
              c.lat <= bounds.north &&
              lonInRange(c.lon, bounds.west, bounds.east)
            ) {
              candidates.push(c);
            }
          }
        }
      }
      // Cells are visited row-major, not globally population-ordered, so sort the
      // candidate set before taking the top `limit`.
      candidates.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
      return candidates.slice(0, limit);
    }
  }

  // Wide + dense view (or unbounded limit): the population-ordered early-break.
  if (presorted && Number.isFinite(limit)) {
    const out: City[] = [];
    for (const c of cities) {
      if (
        c.lat >= bounds.south &&
        c.lat <= bounds.north &&
        lonInRange(c.lon, bounds.west, bounds.east)
      ) {
        out.push(c);
        if (out.length >= limit) break;
      }
    }
    return out;
  }
  const result = cities.filter(
    (c) =>
      c.lat >= bounds.south &&
      c.lat <= bounds.north &&
      lonInRange(c.lon, bounds.west, bounds.east),
  );
  if (!presorted) result.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  return result.slice(0, limit);
}

/** The list/marker filter the map screen shares between its list and its dots. */
export type CityFilter = "all" | "unvisited" | "visited" | "wishlist";

/** Working set considered "in view" before the on-map marker cap — the same
 *  size the MapScreen list snapshots, so the map dots and the list stay in
 *  lock-step (both flow through `citiesInView`). */
export const IN_VIEW_CAP = 2000;

/**
 * The discoverable ("browse") city dots to paint for a viewport — the cities you
 * have NOT marked, so you can tap one to add it. Your visited flags and want-list
 * dots are drawn as their own always-on markers, so this function never paints
 * them and the cap never touches them: it's the "two counters" split the map
 * shows — **your places (uncapped) vs. discoverable places (capped)**. That means
 * the cap spends its whole budget on non-visited cities and can never wipe them
 * all out to make room for cities you've already been to.
 *
 * - `personalIds` — every city with a personal record (visited OR want-list) in
 *   the active period. Excluded from the browse dots (drawn as pills elsewhere),
 *   so the biggest cities you've visited don't crowd out discoverable ones.
 * - `filter` — when the shared status filter is focused on your OWN places
 *   ("visited"/"wishlist"), the discovery dots step aside entirely (only your
 *   markers show); "all"/"unvisited" show the discoverable cities.
 * - `minPopulation` (0 = off) drops any city below that headcount.
 * - `cap` — the most discoverable dots to draw; `Infinity` = "Unlimited" (every
 *   discoverable city in view, bounded only by the working-set scan).
 *
 * Pure and deterministic so the map can recompute it straight off the live camera
 * on every `moveend` — no React round-trip — and so it's unit-testable.
 */
export function markerCitiesInView(
  cities: City[],
  bounds: Bounds | null,
  cap: number,
  filter: CityFilter = "all",
  personalIds?: ReadonlySet<string>,
  minPopulation = 0,
): City[] {
  if (!bounds) return [];
  // Focused on your own places → no discovery dots; your flags/wishes carry the map.
  if (filter === "visited" || filter === "wishlist") return [];
  // "Unlimited" (cap = Infinity) scans the whole in-view field; a finite cap only
  // needs the bounded working set to have enough candidates to pick the biggest.
  const scanLimit = Number.isFinite(cap) ? IN_VIEW_CAP : Infinity;
  const inView = citiesInView(cities, bounds, scanLimit, true);
  // Drop cities you've already marked — they're painted as your own markers.
  const discoverable = personalIds ? inView.filter((c) => !personalIds.has(c.id)) : inView;
  const filtered =
    minPopulation > 0
      ? discoverable.filter((c) => (c.population ?? 0) >= minPopulation)
      : discoverable;
  const capN = Math.max(1, cap);
  if (filtered.length <= capN) return filtered;
  // `inView` is population-descending and the filters preserve order, so the head
  // is already the biggest cities; sort defensively to guarantee it.
  return [...filtered]
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, capN);
}
