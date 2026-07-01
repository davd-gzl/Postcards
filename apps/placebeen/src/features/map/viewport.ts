import type { City } from "../../lib/reference/types";

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Longitude membership that tolerates a viewport crossing the antimeridian. */
function lonInRange(lon: number, west: number, east: number): boolean {
  return west <= east ? lon >= west && lon <= east : lon >= west || lon <= east;
}

/**
 * Cities whose coordinates fall inside the current map viewport, sorted by
 * population (most people first). This powers the "cities in view" list that
 * updates as the user pans/zooms the map.
 */
export function citiesInView(cities: City[], bounds: Bounds | null, limit = 25): City[] {
  if (!bounds) return [];
  const result = cities.filter(
    (c) =>
      c.lat >= bounds.south &&
      c.lat <= bounds.north &&
      lonInRange(c.lon, bounds.west, bounds.east),
  );
  result.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  return result.slice(0, limit);
}
