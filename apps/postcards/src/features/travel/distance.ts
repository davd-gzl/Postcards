import type { PlaceRef, TravelMode, Trip } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { MODE_ORDER } from "./modes";

/** Resolve a place reference to coordinates, if it has any (cities, airports, heritage sites do). */
export function coordsOf(place: PlaceRef, ref: ReferenceData): { lon: number; lat: number } | null {
  if (place.kind === "city") {
    const c = ref.cityById(place.id);
    return c ? { lon: c.lon, lat: c.lat } : null;
  }
  if (place.kind === "airport") {
    const a = ref.airportById(place.id);
    return a ? { lon: a.lon, lat: a.lat } : null;
  }
  if (place.kind === "heritage") {
    const h = ref.heritageById(place.id);
    // Some sites have no coordinate in the source (stored as 0,0) — treat as unknown.
    return h && (h.lat !== 0 || h.lon !== 0) ? { lon: h.lon, lat: h.lat } : null;
  }
  return null; // countries have no single coordinate
}

const R_KM = 6371; // mean Earth radius
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km between two lon/lat points. */
export function haversineKm(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Total great-circle distance along an ordered chain of stops (spec 019): the sum of
 * the leg distances between consecutive stops. A leg touching a stop with no
 * coordinate contributes nothing and is counted in `unresolvedLegs`, so one missing
 * point never zeroes the whole trip. Fewer than two stops → zero.
 */
export function tripPathKm(
  stops: PlaceRef[],
  ref: ReferenceData,
): { km: number; unresolvedLegs: number } {
  let km = 0;
  let unresolvedLegs = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = coordsOf(stops[i]!, ref);
    const b = coordsOf(stops[i + 1]!, ref);
    if (a && b) km += haversineKm(a, b);
    else unresolvedLegs += 1;
  }
  return { km, unresolvedLegs };
}

/**
 * A trip's great-circle distance. A multi-stop trip (stops present) sums its path;
 * a legacy single-leg trip uses its `from → to` endpoints. Returns null only when a
 * single-leg trip has an unresolvable endpoint (a multi-stop trip always returns a
 * number — possibly 0 — because partial paths still count).
 */
export function tripDistanceKm(trip: Trip, ref: ReferenceData): number | null {
  if (trip.stops && trip.stops.length >= 2) return tripPathKm(trip.stops, ref).km;
  const from = coordsOf(trip.from, ref);
  const to = coordsOf(trip.to, ref);
  if (!from || !to) return null;
  return haversineKm(from, to);
}

export interface TravelTotals {
  trips: number;
  totalKm: number;
  /** Per-mode { trips, km }, in a stable display order. */
  byMode: { mode: TravelMode; trips: number; km: number }[];
}

/** Aggregate totals across trips; distance sums only trips with two resolvable endpoints. */
export function travelTotals(trips: Trip[], ref: ReferenceData): TravelTotals {
  const per = new Map<TravelMode, { trips: number; km: number }>();
  let totalKm = 0;
  for (const t of trips) {
    const km = tripDistanceKm(t, ref) ?? 0;
    totalKm += km;
    const slot = per.get(t.mode) ?? { trips: 0, km: 0 };
    slot.trips += 1;
    slot.km += km;
    per.set(t.mode, slot);
  }
  const byMode = MODE_ORDER.filter((m) => per.has(m)).map((mode) => ({ mode, ...per.get(mode)! }));
  return { trips: trips.length, totalKm, byMode };
}
