import { describe, it, expect } from "vitest";
import { zipStore, unzipStore, looksLikeZip, crc32 } from "../../src/lib/backup/zip";
import { buildArchive, archiveToJson, MANIFEST_NAME } from "../../src/features/backup/archiveZip";
import { importFile } from "../../src/features/backup/importJson";
import type { Visit } from "../../src/lib/schema/models";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

// A valid 1×1 PNG as an inline data URL (same fixture the backup tests use).
const dataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function visit(): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id: "paris-fr", name: "Paris", countryId: "FR" },
    date: "2019-08-12",
    note: null,
    status: "visited",
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("zip codec (store method)", () => {
  it("round-trips names and bytes", () => {
    const files = [
      { name: MANIFEST_NAME, data: enc('{"hello":"world"}') },
      { name: "photos/0001.png", data: new Uint8Array([0, 1, 2, 255, 254, 128]) },
      { name: "photos/0002.bin", data: new Uint8Array(0) }, // empty file is fine
    ];
    const zip = zipStore(files);
    expect(looksLikeZip(zip)).toBe(true);
    const out = unzipStore(zip);
    expect(out.map((e) => e.name)).toEqual(files.map((f) => f.name));
    expect(dec(out[0]!.data)).toBe('{"hello":"world"}');
    expect([...out[1]!.data]).toEqual([0, 1, 2, 255, 254, 128]);
    expect(out[2]!.data.length).toBe(0);
  });

  it("crc32 matches the known IEEE value for a standard string", () => {
    // crc32("The quick brown fox jumps over the lazy dog") = 0x414FA339
    expect(crc32(enc("The quick brown fox jumps over the lazy dog")) >>> 0).toBe(0x414fa339);
  });

  it("looksLikeZip is false for plain JSON/text", () => {
    expect(looksLikeZip(enc('{"format":"postcards"}'))).toBe(false);
  });
});

describe('"Save everything" archive round-trip (data + photos-as-files)', () => {
  it("stores photos as separate image FILES and a photo-less manifest, then restores identically", () => {
    const original: Visit[] = [
      { ...visit(), photos: [{ src: dataUrl, caption: "the tower" }, { src: dataUrl, caption: null }] },
    ];
    const bytes = buildArchive(original, [], []);
    const entries = unzipStore(bytes);

    // The manifest exists and carries NO inline base64 — photos became file refs.
    const manifest = entries.find((e) => e.name === MANIFEST_NAME)!;
    const manifestText = dec(manifest.data);
    expect(manifestText).not.toContain("base64,");
    expect(manifestText).toContain("zip:photos/");

    // The images live as real files.
    const photoFiles = entries.filter((e) => e.name.startsWith("photos/"));
    expect(photoFiles).toHaveLength(2);
    expect(photoFiles[0]!.name).toBe("photos/0001.png");

    // Unpack → standard JSON → validate → photos are byte-identical to the originals.
    const json = archiveToJson(bytes);
    expect(json).toContain("base64,"); // re-inlined
    const result = importFile(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visits[0]!.photos).toEqual([
        { src: dataUrl, caption: "the tower" },
        { src: dataUrl, caption: null },
      ]);
    }
  });

  it("drops a photo whose image file is missing rather than breaking the restore", () => {
    const original: Visit[] = [{ ...visit(), photos: [{ src: dataUrl, caption: null }] }];
    const bytes = buildArchive(original, [], []);
    // Rebuild the archive WITHOUT the photo file, keeping only the manifest.
    const entries = unzipStore(bytes).filter((e) => e.name === MANIFEST_NAME);
    const stripped = zipStore(entries.map((e) => ({ name: e.name, data: e.data })));
    const result = importFile(archiveToJson(stripped));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visits[0]!.photos ?? []).toHaveLength(0);
  });
});
