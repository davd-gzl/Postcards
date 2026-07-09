import { describe, it, expect } from "vitest";
import { serializeFile } from "../../src/features/backup/exportJson";
import { importFile } from "../../src/features/backup/importJson";
import type { Visit } from "../../src/lib/schema/models";

function visit(): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id: "paris-fr", name: "Paris", countryId: "FR" },
    date: "2019-08-12",
    note: "first trip",
    status: "visited" as const,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("backup round-trip (SC-003)", () => {
  it("export -> import restores identical visits", () => {
    const original = [visit()];
    const text = serializeFile(original);
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visits).toEqual(original);
  });
});

describe("postcard photos", () => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("accepts an inline image data URL and round-trips it", () => {
    const original = [{ ...visit(), photo: dataUrl }];
    const text = serializeFile(original);
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visits[0]!.photo).toBe(dataUrl);
  });

  it("rejects a photo that is an external URL (privacy: photos must be inline)", () => {
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [{ ...visit(), photo: "https://evil.example/track.png" }],
    });
    expect(importFile(text)).toMatchObject({ ok: false });
  });
});

describe("import security (SC-008, Constitution VI)", () => {
  it("rejects malformed JSON", () => {
    expect(importFile("{not json")).toMatchObject({ ok: false });
  });

  it("rejects a file without the format marker", () => {
    expect(importFile(JSON.stringify({ visits: [] }))).toMatchObject({ ok: false });
  });

  it("rejects a newer schema version", () => {
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 99,
      exportedAt: new Date().toISOString(),
      visits: [],
    });
    expect(importFile(text)).toMatchObject({ ok: false });
  });

  it("rejects unknown keys (strict)", () => {
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [],
      malicious: { __proto__: { polluted: true } },
    });
    expect(importFile(text)).toMatchObject({ ok: false });
  });

  it("rejects unknown keys inside a nested place object (strict)", () => {
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [
        {
          visitId: crypto.randomUUID(),
          place: { kind: "city", id: "paris-fr", name: "Paris", countryId: "FR", evil: 1 },
          date: null,
          note: null,
          status: "visited" as const,
          favorite: false,
          addedAt: new Date().toISOString(),
        },
      ],
    });
    expect(importFile(text)).toMatchObject({ ok: false });
  });

  it("merges duplicate places on import (FR-015)", () => {
    const mk = (note: string) => ({
      visitId: crypto.randomUUID(),
      place: { kind: "city", id: "paris-fr", name: "Paris", countryId: "FR" },
      date: null,
      note,
      status: "visited" as const,
      favorite: false,
      addedAt: new Date().toISOString(),
    });
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [mk("first"), mk("second")],
    });
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visits).toHaveLength(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it("accepts a legacy Place'Been file (format: placebeen) for backward compatibility", () => {
    const text = JSON.stringify({
      format: "placebeen", // pre-rename marker
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [{ ...visit(), visitId: "legacy-1" }],
    });
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visits).toHaveLength(1);
  });

  it("accepts a non-UUID, hand-written visit id (portable/AI-friendly file)", () => {
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [{ ...visit(), visitId: "00000000-0000-0000-0000-000000000001" }],
    });
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visits[0]!.visitId).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("sanitizes formula-like content in notes instead of executing it", () => {
    const text = JSON.stringify({
      format: "postcards",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [
        {
          visitId: crypto.randomUUID(),
          place: { kind: "city", id: "paris-fr", name: "Paris", countryId: "FR" },
          date: null,
          note: "=IMPORTXML(evil)",
          status: "visited" as const,
          favorite: false,
          addedAt: new Date().toISOString(),
        },
      ],
    });
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visits[0]!.note).toBe("IMPORTXML(evil)");
  });
});
