import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { portableFileJsonSchema } from "../../src/lib/schema/jsonSchema";

// Vitest runs from apps/postcards (jsdom rewrites import.meta.url, so cwd it is).
const ARTIFACT = resolve(process.cwd(), "src/lib/schema/portable-file.schema.json");

// The published schema is a build artifact generated from the Zod models.
// `pnpm schema` (UPDATE_SCHEMA=1) rewrites it; this test then keeps it honest —
// any model change without a regenerated artifact fails CI.
describe("published portable-file JSON Schema", () => {
  it("matches the Zod models (run `pnpm schema` after changing them)", () => {
    const generated = portableFileJsonSchema();
    if (process.env.UPDATE_SCHEMA) {
      writeFileSync(ARTIFACT, JSON.stringify(generated, null, 2) + "\n");
    }
    expect(existsSync(ARTIFACT)).toBe(true);
    const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8")) as unknown;
    expect(artifact).toEqual(generated);
  });

  it("is a self-describing draft 2020-12 schema", () => {
    const s = portableFileJsonSchema();
    expect(s.$schema).toContain("2020-12");
    expect(s.title).toContain("Postcards portable data file");
    expect((s.properties as Record<string, unknown>).visits).toBeTruthy();
  });
});
