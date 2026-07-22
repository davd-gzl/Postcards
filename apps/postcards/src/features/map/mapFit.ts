// Antimeridian-aware framing shared by the main map and the trip composer's
// route map. The tightest longitude frame is the COMPLEMENT of the largest gap
// between consecutive sorted longitudes (wrapping counts as a gap), so Fiji +
// Samoa frame tight instead of spanning the whole globe. Pure & testable.

export type LngLatBounds = [[number, number], [number, number]];

/** Bounds `[[west, south], [east, north]]` enclosing all coords, or null when
 *  there are none. `east` may exceed 180 when the frame crosses the antimeridian. */
export function fitBounds(coords: { lon: number; lat: number }[]): LngLatBounds | null {
  if (!coords.length) return null;
  let south = Infinity;
  let north = -Infinity;
  for (const c of coords) {
    south = Math.min(south, c.lat);
    north = Math.max(north, c.lat);
  }
  const lons = coords.map((c) => c.lon).sort((a, b) => a - b);
  let gapAfter = lons.length - 1;
  let gapSize = lons[0]! + 360 - lons[lons.length - 1]!; // the wrap-around gap
  for (let i = 1; i < lons.length; i++) {
    const g = lons[i]! - lons[i - 1]!;
    if (g > gapSize) {
      gapSize = g;
      gapAfter = i - 1;
    }
  }
  const west = lons[(gapAfter + 1) % lons.length]!;
  let east = lons[gapAfter]!;
  if (east < west) east += 360; // the frame crosses the antimeridian
  return [
    [west, south],
    [east, north],
  ];
}
