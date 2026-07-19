import type { WikivoyageLink, WikivoyagePlaceInput } from "./types";
import { articleUrl, phrasebookTitle } from "./urls";
import { DEFAULT_LANG } from "./urls";

/**
 * Build the set of Wikivoyage guide links for a place: the city guide (if any),
 * the country guide, the country's "Understand" overview, and a phrasebook per
 * spoken language (which also covers the alphabet & pronunciation). Pure and
 * offline-safe — every entry is just a link the app can open.
 */
export function guidesFor(input: WikivoyagePlaceInput, lang: string = DEFAULT_LANG): WikivoyageLink[] {
  const links: WikivoyageLink[] = [];
  const iso = input.countryIso2.toLowerCase();

  if (input.cityName) {
    links.push({
      id: `place:${iso}:${input.cityName}`,
      kind: "place",
      name: input.cityName,
      title: input.cityName,
      url: articleUrl(input.cityName, lang),
    });
  }

  links.push({
    id: `country:${iso}`,
    kind: "country",
    name: input.countryName,
    title: input.countryName,
    url: articleUrl(input.countryName, lang),
  });

  links.push({
    id: `understand:${iso}`,
    kind: "understand",
    name: input.countryName,
    title: input.countryName,
    url: articleUrl(input.countryName, lang, "Understand"),
  });

  const seen = new Set<string>();
  for (const l of input.languages ?? []) {
    const name = l.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const title = phrasebookTitle(name);
    links.push({
      id: `phrasebook:${name}`,
      kind: "phrasebook",
      name,
      title,
      url: articleUrl(title, lang),
    });
  }

  return links;
}
