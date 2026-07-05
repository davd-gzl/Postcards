import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { toMarkdown } from "../../src/features/backup/exportMarkdown";
import type { Visit } from "../../src/lib/schema/models";

const ref = getReferenceData();

function visit(name: string, note: string | null): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id: "x", name, countryId: "FR" },
    date: null,
    note,
    status: "visited" as const,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("toMarkdown", () => {
  it("renders a title and a table", () => {
    const md = toMarkdown([visit("Paris", null)], [], ref);
    expect(md).toContain("# Places I've been");
    expect(md).toContain("| Place | Type | Country | Date |");
    expect(md).toContain("Paris");
  });

  it("escapes pipes so free text cannot break the table", () => {
    const md = toMarkdown([visit("A|B", "note|with|pipes")], [], ref);
    expect(md).toContain("A\\|B");
    expect(md).not.toMatch(/\| A\|B \|/); // raw unescaped pipe must not appear
  });

  it("neutralizes inline HTML in names so a shared summary stays inert", () => {
    const md = toMarkdown([visit("<img src=x onerror=alert(1)>", null)], [], ref);
    expect(md).not.toContain("<img"); // raw HTML must not survive to the shared file
    expect(md).toContain("&lt;img");
  });
});
