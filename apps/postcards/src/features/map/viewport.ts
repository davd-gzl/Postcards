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
// Above this many covered cells the grid stops paying off — the population
// early-break wins for continental/world views. ~1024 ≈ a 32°×32° window.
const CELL_MAX = 1024;

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

  // Fast path: a zoomed-in view touches few grid cells — visit only those.
  if (Number.isFinite(limit)) {
    const row0 = clampRow(bounds.south);
    const row1 = clampRow(bounds.north);
    const { startCol, colCount } = columnSpan(bounds);
    const cellCount = (row1 - row0 + 1) * colCount;
    if (cellCount <= CELL_MAX) {
      const g = ensureGrid(cities);
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
      // (small) candidate set before taking the top `limit`.
      candidates.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
      return candidates.slice(0, limit);
    }
  }

  // Wide view (or unbounded limit): the population-ordered early-break.
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
