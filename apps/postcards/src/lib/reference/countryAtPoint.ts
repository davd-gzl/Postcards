import type { City } from "./types";

// Reverse-geocode a point to a country, offline, from the gazetteer we already
// have: the country of the NEAREST known city. Adding a place should be about
// naming the spot, not hunting for its country — so a dropped pin fills the
// country in for you (still editable). This is a cheap heuristic, not a border
// authority: near a frontier the nearest city can be across the line, which is
// why the field stays a normal, overridable select.
//
// A widening bounding-box prefilter keeps the squared-distance test off most of
// the ~135k rows; within a few degrees the lat/lon plane is flat enough that
// squared-degree distance ranks nearest correctly without haversine's cost.

/** ISO alpha-2 of the nearest city to (lat, lon), or null if none is near. */
export function countryAtPoint(cities: readonly City[], lat: number, lon: number): string | null {
  for (const box of [1, 3, 8, 20]) {
    let bestCc: string | null = null;
    let bestD = Infinity;
    for (const c of cities) {
      const dLat = c.lat - lat;
      const dLon = c.lon - lon;
      if (dLat > box || dLat < -box || dLon > box || dLon < -box) continue;
      const d = dLat * dLat + dLon * dLon;
      if (d < bestD) {
        bestD = d;
        bestCc = c.countryIso2;
      }
    }
    if (bestCc) return bestCc;
  }
  return null;
}
