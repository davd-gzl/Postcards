import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { inScope, type CountryScope } from "../../lib/reference/scope";

/** Whether a visited country id counts under the chosen scope (unknown ids: only under "all"). */
function countryInScope(ref: ReferenceData, iso2: string, scope: CountryScope): boolean {
  const c = ref.countryByIso2(iso2);
  return c ? inScope(c.sovereignty, scope) : scope === "all";
}

export interface Coverage {
  countriesVisited: number;
  worldCountryCount: number;
  worldPct: number; // 0..1
  citiesVisited: number;
  airportsVisited: number;
  monumentsVisited: number;
}

export interface CountryCoverage {
  iso2: string;
  name: string;
  citiesVisited: number;
  citiesTotal: number;
  cityPct: number; // 0..1
  regionsVisited: number;
  regionsTotal: number;
  regionPct: number; // 0..1
  heritageVisited: number;
  heritageTotal: number;
  heritagePct: number; // 0..1
}

function pct(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

/** Coverage counts only places actually visited — never the wishlist. */
export function onlyVisited(visits: Visit[]): Visit[] {
  return visits.filter((v) => v.status !== "wishlist");
}

/** Distinct country ids across visited records (a city visit implies its country). */
export function visitedCountryIds(visits: Visit[]): Set<string> {
  return new Set(onlyVisited(visits).map((v) => v.place.countryId));
}

export function computeCoverage(
  visits: Visit[],
  ref: ReferenceData,
  scope: CountryScope = "all",
): Coverage {
  const countriesVisited = [...visitedCountryIds(visits)].filter((iso2) =>
    countryInScope(ref, iso2, scope),
  ).length;
  const cityIds = new Set(
    onlyVisited(visits)
      .filter((v) => v.place.kind === "city")
      .map((v) => v.place.id),
  );
  const airportIds = new Set(
    onlyVisited(visits)
      .filter((v) => v.place.kind === "airport")
      .map((v) => v.place.id),
  );
  const monumentIds = new Set(
    onlyVisited(visits)
      .filter((v) => v.place.kind === "heritage")
      .map((v) => v.place.id),
  );
  const worldCountryCount = ref.worldCountryCount(scope);
  return {
    countriesVisited,
    worldCountryCount,
    worldPct: pct(countriesVisited, worldCountryCount),
    citiesVisited: cityIds.size,
    airportsVisited: airportIds.size,
    monumentsVisited: monumentIds.size,
  };
}

/** Both per-country metrics: % of the country's cities AND % of its regions (FR-007). */
export function computeCountryCoverage(
  visits: Visit[],
  ref: ReferenceData,
  iso2: string,
): CountryCoverage {
  const country = ref.countryByIso2(iso2);
  const visitedCityIds = new Set<string>();
  const visitedRegionIds = new Set<string>();
  for (const v of onlyVisited(visits)) {
    if (v.place.kind !== "city") continue;
    // Only count cities that exist in this country's gazetteer, so the numerator
    // can never exceed the denominator (imported cities outside the dataset don't inflate %).
    const city = ref.cityById(v.place.id);
    if (!city || city.countryIso2 !== iso2) continue;
    visitedCityIds.add(v.place.id);
    if (city.subdivisionId) visitedRegionIds.add(city.subdivisionId);
  }
  // Heritage sites (a "category"): visited sites in this country vs the total there.
  // Membership is by the country's own site list (heritageOf), so a transnational
  // site that spans several countries counts toward each — matching the denominator.
  const heritageIdsHere = new Set(ref.heritageOf(iso2).map((h) => h.id));
  const heritageTotal = heritageIdsHere.size;
  const heritageVisited = new Set(
    onlyVisited(visits)
      .filter((v) => v.place.kind === "heritage" && heritageIdsHere.has(v.place.id))
      .map((v) => v.place.id),
  ).size;

  const citiesTotal = country?.cityCount ?? 0;
  const regionsTotal = country?.subdivisionCount ?? 0;
  return {
    iso2,
    name: country?.name ?? iso2,
    citiesVisited: visitedCityIds.size,
    citiesTotal,
    cityPct: pct(visitedCityIds.size, citiesTotal),
    regionsVisited: visitedRegionIds.size,
    regionsTotal,
    regionPct: pct(visitedRegionIds.size, regionsTotal),
    heritageVisited,
    heritageTotal,
    heritagePct: pct(heritageVisited, heritageTotal),
  };
}

export interface ContinentCoverage {
  continent: string;
  visited: number;
  total: number;
  pct: number; // 0..1
}

/** Countries visited per continent, against each continent's full country count. */
export function computeContinentCoverage(
  visits: Visit[],
  ref: ReferenceData,
  scope: CountryScope = "all",
): ContinentCoverage[] {
  const totals = new Map<string, number>();
  for (const c of ref.countries) {
    if (!c.continent || !inScope(c.sovereignty, scope)) continue;
    totals.set(c.continent, (totals.get(c.continent) ?? 0) + 1);
  }
  const visitedByContinent = new Map<string, Set<string>>();
  for (const iso2 of visitedCountryIds(visits)) {
    if (!countryInScope(ref, iso2, scope)) continue;
    const continent = ref.countryByIso2(iso2)?.continent;
    if (!continent) continue;
    if (!visitedByContinent.has(continent)) visitedByContinent.set(continent, new Set());
    visitedByContinent.get(continent)!.add(iso2);
  }
  return [...visitedByContinent.entries()]
    .map(([continent, set]) => {
      const total = totals.get(continent) ?? 0;
      return { continent, visited: set.size, total, pct: pct(set.size, total) };
    })
    .sort((a, b) => b.visited - a.visited || a.continent.localeCompare(b.continent));
}

export interface CountryDetail {
  cities: string[];
  regionsVisited: string[];
  regionsRemaining: number;
  /** Names of the country's first-level regions not yet visited (what's left to see). */
  regionsRemainingNames: string[];
  monumentsVisited: string[];
  monumentsRemaining: string[];
}

/** Names behind a country's numbers: visited cities + covered regions + monuments,
 *  and — the headline for "what's left" — the NAMES of the regions still to visit. */
export function countryDetail(visits: Visit[], ref: ReferenceData, iso2: string): CountryDetail {
  const cities: string[] = [];
  const regionIds = new Set<string>();
  for (const v of onlyVisited(visits)) {
    if (v.place.kind !== "city") continue;
    const city = ref.cityById(v.place.id);
    if (!city || city.countryIso2 !== iso2) continue;
    cities.push(city.name);
    if (city.subdivisionId) regionIds.add(city.subdivisionId);
  }
  cities.sort((a, b) => a.localeCompare(b));
  const regionsVisited = [...regionIds]
    .map((id) => ref.subdivisionById(id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b));
  const allSubs = ref.subdivisionsOf(iso2);
  const regionsRemainingNames = allSubs
    .filter((s) => !regionIds.has(s.id))
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b));
  const totalRegions = ref.countryByIso2(iso2)?.subdivisionCount ?? 0;

  // Monuments (heritage) visited here vs the rest of the country's list.
  const visitedMonumentIds = new Set(
    onlyVisited(visits)
      .filter((v) => v.place.kind === "heritage")
      .map((v) => v.place.id),
  );
  const here = ref.heritageOf(iso2);
  const monumentsVisited = here
    .filter((h) => visitedMonumentIds.has(h.id))
    .map((h) => h.name)
    .sort((a, b) => a.localeCompare(b));
  const monumentsRemaining = here
    .filter((h) => !visitedMonumentIds.has(h.id))
    .map((h) => h.name)
    .sort((a, b) => a.localeCompare(b));

  return {
    cities,
    regionsVisited,
    regionsRemaining: Math.max(0, totalRegions - regionIds.size),
    regionsRemainingNames,
    monumentsVisited,
    monumentsRemaining,
  };
}

export interface TravelRecords {
  northernmost: { name: string; lat: number } | null;
  southernmost: { name: string; lat: number } | null;
  biggestCity: { name: string; population: number } | null;
  firstVisit: { name: string; date: string } | null;
  latestVisit: { name: string; date: string } | null;
}

/** Fun superlatives across visited cities (dates use the visit's own date field). */
export function computeRecords(visits: Visit[], ref: ReferenceData): TravelRecords {
  let north: { name: string; lat: number } | null = null;
  let south: { name: string; lat: number } | null = null;
  let biggest: { name: string; population: number } | null = null;
  let first: { name: string; date: string } | null = null;
  let latest: { name: string; date: string } | null = null;
  for (const v of onlyVisited(visits)) {
    if (v.date) {
      if (!first || v.date < first.date) first = { name: v.place.name, date: v.date };
      if (!latest || v.date > latest.date) latest = { name: v.place.name, date: v.date };
    }
    if (v.place.kind !== "city") continue;
    const c = ref.cityById(v.place.id);
    if (!c) continue;
    if (!north || c.lat > north.lat) north = { name: c.name, lat: c.lat };
    if (!south || c.lat < south.lat) south = { name: c.name, lat: c.lat };
    if (c.population != null && (!biggest || c.population > biggest.population)) {
      biggest = { name: c.name, population: c.population };
    }
  }
  return { northernmost: north, southernmost: south, biggestCity: biggest, firstVisit: first, latestVisit: latest };
}

export type CountrySort = "cities" | "regions" | "name";

/** Countries with recorded visits, sorted by the chosen key, for the stats list. */
export function visitedCountriesList(
  visits: Visit[],
  ref: ReferenceData,
  sortBy: CountrySort = "cities",
  scope: CountryScope = "all",
): CountryCoverage[] {
  const list = [...visitedCountryIds(visits)]
    .filter((iso2) => countryInScope(ref, iso2, scope))
    .map((iso2) => computeCountryCoverage(visits, ref, iso2));
  const byName = (a: CountryCoverage, b: CountryCoverage) => a.name.localeCompare(b.name);
  const cmp: Record<CountrySort, (a: CountryCoverage, b: CountryCoverage) => number> = {
    cities: (a, b) => b.citiesVisited - a.citiesVisited || byName(a, b),
    regions: (a, b) => b.regionsVisited - a.regionsVisited || byName(a, b),
    name: byName,
  };
  return list.sort(cmp[sortBy]);
}
