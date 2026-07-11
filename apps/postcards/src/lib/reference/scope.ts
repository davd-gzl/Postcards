// What counts as a "country" — a user preference. Dependent territories (Hong
// Kong, Jersey, Puerto Rico, Greenland, Taiwan, Kosovo, …) can be included in the
// count and the checklist, or excluded to leave only UN member states. The
// UN-member / territory classification comes from the world-countries dataset
// (ODbL); this module only chooses which tiers a scope admits.

export type Sovereignty = "un" | "territory";
export type CountryScope = "all" | "un";

export const DEFAULT_SCOPE: CountryScope = "all";

/** Does a country of the given statehood count under this scope? */
export function inScope(sovereignty: Sovereignty, scope: CountryScope): boolean {
  return scope === "all" || sovereignty === "un";
}
