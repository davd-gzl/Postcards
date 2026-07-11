import { describe, it, expect } from "vitest";
import { serializeFile } from "../../src/features/backup/exportJson";
import { importFile } from "../../src/features/backup/importJson";
import { StorySchema, type Story } from "../../src/lib/schema/models";
import { sortStories } from "../../src/lib/store/useStories";

const dataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function story(): Story {
  return {
    storyId: crypto.randomUUID(),
    place: { kind: "city", id: "paris-fr", name: "Paris", countryId: "FR" },
    date: "2019-08-12",
    title: "Three days in the old town",
    text: "We got lost twice.\nWorth it.",
    addedAt: new Date().toISOString(),
  };
}

describe("journal round-trip", () => {
  it("export -> import restores an identical story (photo included)", () => {
    const original = [{ ...story(), photos: [{ src: dataUrl, caption: "the view" }] }];
    const result = importFile(serializeFile([], [], original));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stories).toEqual(original);
  });

  it("preserves the story's line breaks through export -> import", () => {
    const result = importFile(serializeFile([], [], [story()]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stories[0]!.text).toBe("We got lost twice.\nWorth it.");
  });

  it("rejects a story photo whose src is an external URL (privacy: photos must be inline)", () => {
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
      visits: [],
      stories: [{ ...story(), photos: [{ src: "https://evil.example/track.png" }] }],
    });
    expect(importFile(text)).toMatchObject({ ok: false });
  });

  it("imports a v4 file without a stories key (older files unchanged)", () => {
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      visits: [],
    });
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stories).toEqual([]);
  });

  it("merges duplicate story ids on import (last-wins, like trips)", () => {
    const dup = story();
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
      visits: [],
      stories: [dup, { ...dup, title: "Second telling" }],
    });
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stories).toHaveLength(1);
      expect(result.stories[0]!.title).toBe("Second telling");
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});

describe("StorySchema (strict, sanitized)", () => {
  it("requires a date and a non-empty title", () => {
    const noDate = { ...story() } as Record<string, unknown>;
    delete noDate.date;
    expect(StorySchema.safeParse(noDate).success).toBe(false);
    expect(StorySchema.safeParse({ ...story(), title: "" }).success).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(StorySchema.safeParse({ ...story(), evil: 1 }).success).toBe(false);
  });

  it("sanitizes formula-like title and text instead of executing them", () => {
    const r = StorySchema.parse({ ...story(), title: "=HYPERLINK(evil)", text: "=IMPORTXML(evil)" });
    expect(r.title).toBe("HYPERLINK(evil)");
    expect(r.text).toBe("IMPORTXML(evil)");
  });

  it("caps a story's gallery at 24 photos", () => {
    const photos = Array.from({ length: 25 }, () => ({ src: dataUrl, caption: null }));
    expect(StorySchema.safeParse({ ...story(), photos }).success).toBe(false);
  });
});

describe("journal ordering", () => {
  it("sorts newest story date first", () => {
    const a = { ...story(), date: "2020-01-01" };
    const b = { ...story(), date: "2023-05-05" };
    const c = { ...story(), date: "2021-12-31" };
    expect(sortStories([a, b, c]).map((s) => s.date)).toEqual([
      "2023-05-05",
      "2021-12-31",
      "2020-01-01",
    ]);
  });
});
