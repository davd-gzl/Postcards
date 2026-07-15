import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { Trip, Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { coordsOf } from "../travel/distance";

function isVisited(v: Visit): boolean {
  return v.status !== "wishlist";
}

/**
 * Point features for visited cities. Each carries what the flag marker needs
 * (country code, favourite flag, collision sort key) plus the details shown in
 * the tap popup (exact population and region name) — the population is
 * deliberately NOT rendered on the marker, only revealed on tap.
 */
export function visitedCityPoints(visits: Visit[], ref: ReferenceData): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const v of visits) {
    if (!isVisited(v)) continue;
    // User-authored custom points carry their own coordinates on the record.
    if (v.place.kind === "custom") {
      if (v.place.lat == null || v.place.lon == null) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.place.lon, v.place.lat] },
        properties: {
          id: v.place.id,
          name: v.place.name,
          cc: v.place.countryId,
          pop: 0,
          region: "",
          custom: 1,
          fav: v.favorite ? 1 : 0,
          sortKey: 0,
        },
      });
      continue;
    }
    if (v.place.kind !== "city") continue;
    const city = ref.cityById(v.place.id);
    if (!city) continue;
    const region = city.subdivisionId ? ref.subdivisionById(city.subdivisionId)?.name ?? "" : "";
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [city.lon, city.lat] },
      properties: {
        id: city.id,
        name: city.name,
        cc: city.countryIso2,
        pop: city.population ?? 0,
        region,
        custom: 0,
        fav: v.favorite ? 1 : 0,
        sortKey: -(city.population ?? 0),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Point features for wish-to-go cities (drawn as distinct wish markers). */
export function wishlistCityPoints(visits: Visit[], ref: ReferenceData): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const v of visits) {
    if (v.status !== "wishlist" || v.place.kind !== "city") continue;
    const city = ref.cityById(v.place.id);
    if (!city) continue;
    const region = city.subdivisionId ? ref.subdivisionById(city.subdivisionId)?.name ?? "" : "";
    // Same property shape as visitedCityPoints — the tap popup builds its
    // PlaceRef from `id`, so omitting it here would toggle a phantom "" city.
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [city.lon, city.lat] },
      properties: {
        id: city.id,
        name: city.name,
        cc: city.countryIso2,
        pop: city.population ?? 0,
        region,
        custom: 0,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function toXYZ(lon: number, lat: number): [number, number, number] {
  const la = lat * D2R;
  const lo = lon * D2R;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/**
 * Points along the great circle between two lon/lat, densified so the route
 * curves correctly in the map projection (a straight LineString would render as
 * a projection-straight chord, not the real path). Longitudes are unwrapped so
 * a route crossing the antimeridian doesn't streak across the map.
 */
function greatCircle(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
  n = 48,
): [number, number][] {
  const A = toXYZ(a.lon, a.lat);
  const B = toXYZ(b.lon, b.lat);
  const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return [[a.lon, a.lat], [b.lon, b.lat]];
  const sin = Math.sin(omega);
  const pts: [number, number][] = [];
  let prev: number | null = null;
  let off = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s1 = Math.sin((1 - t) * omega) / sin;
    const s2 = Math.sin(t * omega) / sin;
    const x = A[0] * s1 + B[0] * s2;
    const y = A[1] * s1 + B[1] * s2;
    const z = A[2] * s1 + B[2] * s2;
    const lat = Math.asin(Math.max(-1, Math.min(1, z))) * R2D;
    let lon = Math.atan2(y, x) * R2D;
    if (prev !== null) {
      while (lon + off - prev > 180) off -= 360;
      while (lon + off - prev < -180) off += 360;
    }
    lon += off;
    pts.push([lon, lat]);
    prev = lon;
  }
  return pts;
}

/**
 * Great-circle arcs for logged trips whose endpoints resolve to coordinates,
 * tagged with the travel mode so the map can colour them. Trips with a
 * coordinate-less endpoint (e.g. a whole country) are skipped — nothing invented.
 */
export function tripArcs(trips: Trip[], ref: ReferenceData): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (const t of trips) {
    const from = coordsOf(t.from, ref);
    const to = coordsOf(t.to, ref);
    if (!from || !to) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: greatCircle(from, to) },
      properties: { mode: t.mode },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Point features for logged airports, carrying the IATA code label, a favorite
 * flag, and whether it's a wish (want to fly through) vs visited — the marker
 * canvas colors itself accordingly. Kept separate from city pills so a plane
 * marker never looks like a city.
 */
export function airportPoints(visits: Visit[], ref: ReferenceData): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const v of visits) {
    if (v.place.kind !== "airport") continue;
    const airport = ref.airportById(v.place.id);
    if (!airport) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [airport.lon, airport.lat] },
      properties: {
        iata: airport.id,
        wish: v.status === "wishlist" ? 1 : 0,
        fav: v.favorite ? 1 : 0,
      },
    });
  }
  return { type: "FeatureCollection", features };
}
