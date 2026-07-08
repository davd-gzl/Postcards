// Continent/region categories (from world-countries "region") and their colors.
// Palette validated with the dataviz skill's validator (worst adjacent CVD ΔE 25
// on the light map surface — well clear of the ≥12 target).
export const CONTINENTS = ["Europe", "Asia", "Africa", "Americas", "Oceania", "Antarctic"] as const;

export type Continent = (typeof CONTINENTS)[number];

export const CONTINENT_COLORS: Record<string, string> = {
  Europe: "#2a78d6",
  Asia: "#1baf7a",
  Africa: "#eb6834",
  Americas: "#4a3aa7",
  Oceania: "#e87ba4",
  Antarctic: "#7a8699",
};

export const CONTINENT_FALLBACK = "#22c55e";

export function continentColor(continent: string | undefined): string {
  return (continent && CONTINENT_COLORS[continent]) || CONTINENT_FALLBACK;
}
