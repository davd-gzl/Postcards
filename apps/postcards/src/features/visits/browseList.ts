import type { City, HeritageSite, ReferenceData } from "../../lib/reference/types";
import type { PlaceRef, Visit } from "../../lib/schema/models";
import { visitIndex } from "../../lib/store/useVisits";
import { placeKey } from "../../lib/schema/helpers";
import type { FilterState } from "../../lib/store/useFilters";

// The unified browse engine (spec 018 US2): given a place KIND and a STATUS/scope,
// list the reference places (the whole world) with each row's personal status
// overlaid from the user's records. Pure & offline — reads only the passed-in
// reference data + visits, invents nothing (Constitution I). The huge city
// gazetteer is never returned whole: cities are population-ranked and capped
// (Constitution VII / FR-005).

export type BrowseKind = "cities" | "monuments" | "airports";
/** The single status axis, mapped to a browse predicate. */
export type BrowseStatus = "all" | "visited" | "wishlist" | "favorites" | "notVisited";

export interface BrowseRow {
  kind: PlaceRef["kind"];
  id: string;
  name: string;
  /** Secondary line — country (+ city for airports), + category tag handled by the UI. */
  sub: string;
  countryIso2: string;
  place: PlaceRef;
  status: "visited" | "wishlist" | "none";
  favorite: boolean;
  category?: string;
  lat?: number;
  lon?: number;
}

/** Bounded working set for the ~135k-city gazetteer — never render it all. */
export const CITY_BROWSE_CAP = 300;
/** How many most-populous cities to keep as the browsable pool (before filtering). */
const CITY_POOL = 2000;

// The population-ranked city pool is expensive to build (sort over ~135k), so it's
// memoised at module scope, re-derived only when the gazetteer's size changes (it
// streams in once from the starter set to the full set). Keyed by source length —
// a cheap, deterministic generation proxy.
let cityPool: { srcLen: number; cities: City[] } | null = null;
function populousCities(ref: ReferenceData): City[] {
  const all = ref.allCities();
  if (cityPool && cityPool.srcLen === all.length) return cityPool.cities;
  const sorted = [...all].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, CITY_POOL);
  cityPool = { srcLen: all.length, cities: sorted };
  return sorted;
}

/** Reset the memoised city pool (tests only). */
export function __resetBrowseCache(): void {
  cityPool = null;
}

export function browseList(
  kind: BrowseKind,
  status: BrowseStatus,
  filter: FilterState,
  ref: ReferenceData,
  visits: Visit[],
  query: string,
): BrowseRow[] {
  const idx = visitIndex(visits);
  const q = query.trim();

  const overlay = (place: PlaceRef) => {
    const v = idx.get(placeKey(place));
    if (!v) return { status: "none" as const, favorite: false };
    return { status: (v.status === "wishlist" ? "wishlist" : "visited") as "visited" | "wishlist", favorite: !!v.favorite };
  };
  const passStatus = (s: "visited" | "wishlist" | "none", fav: boolean): boolean => {
    switch (status) {
      case "visited": return s === "visited";
      case "wishlist": return s === "wishlist";
      case "favorites": return fav;
      case "notVisited": return s === "none";
      default: return true; // "all"
    }
  };
  const continentOk = (iso2: string) => !filter.continent || ref.continentOf(iso2) === filter.continent;
  const countryName = (iso2: string) => ref.countryByIso2(iso2)?.name ?? iso2;

  const rows: BrowseRow[] = [];

  if (kind === "cities") {
    // Scope-first: a search narrows first; otherwise the most-populous pool.
    const base: City[] = q ? ref.searchCities(q, 500) : populousCities(ref);
    for (const c of base) {
      if (!continentOk(c.countryIso2)) continue;
      if (filter.minPop > 0 && (c.population ?? 0) < filter.minPop) continue;
      const place: PlaceRef = { kind: "city", id: c.id, name: c.name, countryId: c.countryIso2 };
      const o = overlay(place);
      if (!passStatus(o.status, o.favorite)) continue;
      rows.push({
        kind: "city", id: c.id, name: c.name, sub: countryName(c.countryIso2),
        countryIso2: c.countryIso2, place, status: o.status, favorite: o.favorite, lat: c.lat, lon: c.lon,
      });
      if (rows.length >= CITY_BROWSE_CAP) break; // bounded — never all 135k
    }
    return rows;
  }

  if (kind === "monuments") {
    let base: HeritageSite[] = q
      ? ref.searchHeritage(q, 500)
      : [...ref.allHeritage()].sort((a, b) => a.name.localeCompare(b.name));
    // Searchable BY COUNTRY (FR-007): a query that names a country surfaces that
    // country's sites, not only ones whose own name matches the query.
    if (q) {
      const iso2s = new Set(ref.searchCountries(q, 3).map((c) => c.iso2));
      if (iso2s.size) {
        const have = new Set(base.map((h) => h.id));
        base = [...base, ...ref.allHeritage().filter((h) => iso2s.has(h.countryIso2) && !have.has(h.id))];
      }
    }
    for (const h of base) {
      if (filter.category && h.category !== filter.category) continue;
      if (!continentOk(h.countryIso2)) continue;
      const place: PlaceRef = { kind: "heritage", id: h.id, name: h.name, countryId: h.countryIso2 };
      const o = overlay(place);
      if (!passStatus(o.status, o.favorite)) continue;
      rows.push({
        kind: "heritage", id: h.id, name: h.name, sub: countryName(h.countryIso2),
        countryIso2: h.countryIso2, place, status: o.status, favorite: o.favorite,
        category: h.category, lat: h.lat, lon: h.lon,
      });
    }
    return rows;
  }

  // airports
  let base = q ? ref.searchAirports(q, 500) : ref.allAirports();
  // Searchable BY COUNTRY (FR-007): a query naming a country surfaces its airports.
  if (q) {
    const iso2s = new Set(ref.searchCountries(q, 3).map((c) => c.iso2));
    if (iso2s.size) {
      const have = new Set(base.map((a) => a.id));
      base = [...base, ...ref.allAirports().filter((a) => iso2s.has(a.countryIso2) && !have.has(a.id))];
    }
  }
  for (const a of base) {
    if (!continentOk(a.countryIso2)) continue;
    const name = `${a.name} (${a.id})`;
    const place: PlaceRef = { kind: "airport", id: a.id, name, countryId: a.countryIso2 };
    const o = overlay(place);
    if (!passStatus(o.status, o.favorite)) continue;
    rows.push({
      kind: "airport", id: a.id, name, sub: [a.city, countryName(a.countryIso2)].filter(Boolean).join(" · "),
      countryIso2: a.countryIso2, place, status: o.status, favorite: o.favorite, lat: a.lat, lon: a.lon,
    });
  }
  return rows;
}
