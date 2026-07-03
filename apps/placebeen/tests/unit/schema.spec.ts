import { describe, it, expect } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";
import { PlaceBeenFileSchema, VisitSchema } from "../../src/lib/schema/models";

function baseVisit() {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "country", id: "FR", name: "France", countryId: "FR" },
    date: null,
    note: null,
    status: "visited" as const,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("PlaceBeenFileSchema", () => {
  it("accepts a well-formed file", () => {
    const r = PlaceBeenFileSchema.safeParse({
      format: "placebeen",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [baseVisit()],
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown top-level keys (strict)", () => {
    const r = PlaceBeenFileSchema.safeParse({
      format: "placebeen",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [],
      evil: "x",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a bad country id", () => {
    const bad = baseVisit();
    bad.place.countryId = "France";
    const r = VisitSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("defaults status/favorite for records from older files", () => {
    const legacy = { ...baseVisit() } as Record<string, unknown>;
    delete legacy.status;
    delete legacy.favorite;
    const r = VisitSchema.parse(legacy);
    expect(r.status).toBe("visited");
    expect(r.favorite).toBe(false);
  });

  it("accepts wishlist + favorite records", () => {
    const r = VisitSchema.parse({ ...baseVisit(), status: "wishlist", favorite: true });
    expect(r.status).toBe("wishlist");
    expect(r.favorite).toBe(true);
  });

  it("sanitizes note on parse (leading formula char removed)", () => {
    const v = { ...baseVisit(), note: "=HYPERLINK(evil)" };
    const r = VisitSchema.parse(v);
    expect(r.note).toBe("HYPERLINK(evil)");
  });

  it("can generate a JSON Schema for external tools (interoperability)", () => {
    const json = zodToJsonSchema(PlaceBeenFileSchema, "PlaceBeenFile") as Record<string, unknown>;
    expect(json).toHaveProperty("$schema");
    expect(JSON.stringify(json)).toContain("PlaceBeenFile");
  });
});
