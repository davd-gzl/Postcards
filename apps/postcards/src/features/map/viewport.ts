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

/**
 * Cities whose coordinates fall inside the current map viewport, sorted by
 * population (most people first). This powers the "cities in view" list that
 * updates as the user pans/zooms the map.
 *
 * Pass `presorted: true` when `cities` is already population-descending (the
 * bundled gazetteer is) — with ~135k world cities, skipping the re-sort on every
 * map move keeps panning smooth.
 */
export function citiesInView(
  cities: City[],
  bounds: Bounds | null,
  limit = 25,
  presorted = false,
): City[] {
  if (!bounds) return [];
  if (presorted && Number.isFinite(limit)) {
    // Population order means the FIRST `limit` matches are already the right
    // ones — stop there. At world zoom that's ~limit iterations instead of a
    // full pass over the 135k-row gazetteer on every map move.
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
