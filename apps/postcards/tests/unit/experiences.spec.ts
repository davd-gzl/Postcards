import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import {
  groupOf,
  groupExperiences,
  placeOf,
  ACROSS_THE_WORLD,
  type Experience,
} from "../../src/features/experiences/grouping";
import { CONTINENT_ORDER } from "../../src/lib/reference/continents";

const here = dirname(fileURLToPath(import.meta.url));
const experiencesFile = JSON.parse(
  readFileSync(join(here, "..", "..", "public", "reference", "experiences.json"), "utf8"),
) as {
  version: number;
  license: string;
  experiences: Experience[];
};
const continents = JSON.parse(
  readFileSync(join(here, "..", "..", "src", "lib", "reference", "data", "continents.json"), "utf8"),
) as Record<string, string>;

const items = experiencesFile.experiences;

// The world experiences added in the provenance-backed V1 expansion. Each MUST
// carry a per-item `sources` list — the app authors no world facts (Constitution).
const ADDED_IDS = [
  "xp-kilimanjaro", "xp-baobab-avenue", "xp-cape-agulhas",
  "xp-galapagos", "xp-inca-trail", "xp-ushuaia", "xp-rapa-nui-moai",
  "xp-monument-valley", "xp-pantanal",
  "xp-mount-fuji", "xp-ha-long-bay", "xp-borobudur", "xp-terracotta-army",
  "xp-dead-sea-float", "xp-registan", "xp-persepolis",
  "xp-santorini-sunset", "xp-acropolis", "xp-stonehenge-solstice",
  "xp-bernina-railway", "xp-cabo-da-roca", "xp-flamenco",
  "xp-uluru", "xp-whitsundays", "xp-rotorua-powhiri",
  "xp-emperor-penguins", "xp-drake-passage",
  "xp-circumnavigate", "xp-cross-ocean", "xp-meteor-shower",
];

describe("experiences.json data integrity", () => {
  it("is version 1 with a mixed-provenance license note", () => {
    expect(experiencesFile.version).toBe(1);
    expect(experiencesFile.license.length).toBeGreaterThan(0);
    expect(experiencesFile.license.toLowerCase()).toContain("mixed");
  });

  it("has unique, xp-prefixed ids", () => {
    const ids = items.map((e) => e.id);
    expect(ids.every((id) => /^xp-[a-z0-9-]+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every anchor uses a real country code and an on-earth coordinate", () => {
    const bad: string[] = [];
    for (const e of items) {
      for (const s of e.where ?? []) {
        if (s.cc && !(s.cc in continents)) bad.push(`${e.id}: unknown cc ${s.cc}`);
        if (s.lat < -90 || s.lat > 90) bad.push(`${e.id}: lat ${s.lat}`);
        if (s.lon < -180 || s.lon > 180) bad.push(`${e.id}: lon ${s.lon}`);
        if (typeof s.name !== "string" || s.name.length === 0) bad.push(`${e.id}: name`);
        if (/[<>]/.test(s.name)) bad.push(`${e.id}: inert`); // names stay inert plain text
      }
    }
    expect(bad).toEqual([]);
  });

  it("every ADDED item carries a non-empty sources[] with a license string", () => {
    for (const id of ADDED_IDS) {
      const e = items.find((x) => x.id === id);
      expect(e, `added item ${id} present`).toBeTruthy();
      expect(Array.isArray(e!.sources) && e!.sources!.length > 0, `${id} has sources`).toBe(true);
      for (const src of e!.sources!) {
        expect(typeof src.dataset).toBe("string");
        expect(src.dataset.length).toBeGreaterThan(0);
        expect(typeof src.license).toBe("string");
        expect(src.license.length).toBeGreaterThan(0);
      }
    }
    // At least the whole expansion is sourced.
    expect(items.filter((e) => e.sources && e.sources.length > 0).length).toBeGreaterThanOrEqual(
      ADDED_IDS.length,
    );
  });

  it("any item that declares sources declares them well-formed", () => {
    for (const e of items) {
      if (!e.sources) continue;
      expect(e.sources.length).toBeGreaterThan(0);
      for (const src of e.sources) expect(src.license?.length).toBeGreaterThan(0);
    }
  });
});

describe("groupOf: a moment's home", () => {
  const ref = getReferenceData();

  const make = (over: Partial<Experience>): Experience => ({
    id: "xp-test",
    emoji: "⭐",
    name: "Test",
    hint: "hint",
    ...over,
  });

  it("derives continent + country from the PRIMARY anchor (where[0])", () => {
    const g = groupOf(
      make({ where: [{ name: "Uluru", lat: -25.34, lon: 131.03, cc: "AU" }] }),
      ref,
    );
    expect(g.continent).toBe("Oceania");
    expect(g.cc).toBe("AU");
    expect(g.country).toBe(ref.countryByIso2("AU")?.name);
  });

  it("uses only the first anchor, ignoring later spots in other continents", () => {
    const g = groupOf(
      make({
        where: [
          { name: "Tromsø", lat: 69.65, lon: 18.96, cc: "NO" },
          { name: "Fairbanks", lat: 64.84, lon: -147.72, cc: "US" },
        ],
      }),
      ref,
    );
    expect(g.continent).toBe("Europe");
    expect(g.cc).toBe("NO");
  });

  it("files worldwide-scope moments under 'Across the world'", () => {
    const g = groupOf(
      make({ scope: "worldwide", where: [{ name: "X", lat: 0, lon: 0, cc: "AQ" }] }),
      ref,
    );
    expect(g.continent).toBe(ACROSS_THE_WORLD);
    expect(g.cc).toBeNull();
    expect(g.country).toBeNull();
  });

  it("files moments with no anchor under 'Across the world'", () => {
    expect(groupOf(make({}), ref).continent).toBe(ACROSS_THE_WORLD);
    expect(groupOf(make({ where: [] }), ref).continent).toBe(ACROSS_THE_WORLD);
  });

  it("guards an unknown/unmapped country code (no throw, borderless fallback)", () => {
    const g = groupOf(make({ where: [{ name: "Nowhere", lat: 0, lon: 0, cc: "ZZ" }] }), ref);
    expect(g.continent).toBe(ACROSS_THE_WORLD);
    expect(g.cc).toBeNull();
  });
});

describe("groupExperiences: ordering", () => {
  const ref = getReferenceData();
  const ex = (id: string, cc?: string, scope?: "worldwide"): Experience => ({
    id,
    emoji: "⭐",
    name: id,
    hint: "",
    ...(scope ? { scope } : {}),
    ...(cc ? { where: [{ name: cc, lat: 0, lon: 0, cc }] } : {}),
  });

  it("orders continents by CONTINENT_ORDER with 'Across the world' pinned last", () => {
    const groups = groupExperiences(
      [
        ex("xp-eu", "FR"), // Europe
        ex("xp-af", "KE"), // Africa
        ex("xp-ww", undefined, "worldwide"), // Across the world
        ex("xp-as", "JP"), // Asia
        ex("xp-oc", "AU"), // Oceania
        ex("xp-am", "US"), // Americas
      ],
      ref,
    );
    const order = groups.map((g) => g.continent);
    // Real continents appear in CONTINENT_ORDER, and the borderless bucket is last.
    const realOnly = order.filter((c) => c !== ACROSS_THE_WORLD);
    const expected = [...CONTINENT_ORDER].filter((c) => realOnly.includes(c));
    expect(realOnly).toEqual(expected);
    expect(order[order.length - 1]).toBe(ACROSS_THE_WORLD);
  });

  it("orders countries within a continent by display name (localeCompare)", () => {
    const groups = groupExperiences(
      [ex("xp-jp", "JP"), ex("xp-cn", "CN"), ex("xp-in", "IN")],
      ref,
    );
    const asia = groups.find((g) => g.continent === "Asia")!;
    const names = asia.countries.map((c) => c.country);
    const sorted = [...names].sort((a, b) => (a ?? "").localeCompare(b ?? ""));
    expect(names).toEqual(sorted);
  });

  it("keeps dataset order for moments within one country (stable)", () => {
    const groups = groupExperiences(
      [ex("xp-fr-a", "FR"), ex("xp-fr-b", "FR"), ex("xp-fr-c", "FR")],
      ref,
    );
    const fr = groups.find((g) => g.continent === "Europe")!.countries[0];
    expect(fr.items.map((e) => e.id)).toEqual(["xp-fr-a", "xp-fr-b", "xp-fr-c"]);
  });

  it("groups the real bundled dataset without throwing and covers real continents", () => {
    const groups = groupExperiences(items, ref);
    expect(groups.length).toBeGreaterThan(1);
    // Every group's continent is a known bucket.
    for (const g of groups) {
      expect([...CONTINENT_ORDER, ACROSS_THE_WORLD]).toContain(g.continent);
    }
  });
});

describe("placeOf: moments never count toward country stats", () => {
  it("always stamps the neutral ZZ country code, for every bundled moment", () => {
    for (const e of items) {
      const p = placeOf(e);
      expect(p.kind).toBe("custom");
      expect(p.countryId).toBe("ZZ");
      expect(p.id).toBe(e.id);
    }
  });
});
