import { describe, it, expect } from "vitest";
import { renderReaderHtml } from "../../src/lib/publish/renderReader";
import { encryptJson } from "../../src/lib/publish/encrypt";
import type { PublishedJourney } from "../../src/lib/publish/bundle";

const journey: PublishedJourney = {
  title: "Three weeks around the Mediterranean",
  subtitle: "Ferries, trains & a lot of gelato",
  dateRange: { start: "2026-05-02", end: "2026-05-20" },
  totals: { countries: 3, places: 3, distanceKm: 2847 },
  steps: [
    {
      place: { kind: "city", id: "par", name: "Paris", countryId: "FR", lat: 48.85, lon: 2.35 },
      lat: 48.85,
      lon: 2.35,
      date: "2026-05-02",
      arriveBy: null,
      story: { title: "Departure day", text: "We left in the rain and it felt right.", date: "2026-05-02" },
      photos: [{ src: "data:image/png;base64,AAAA", caption: "Gare de Lyon" }],
    },
    {
      place: { kind: "city", id: "rom", name: "Rome", countryId: "IT", lat: 41.9, lon: 12.5 },
      lat: 41.9,
      lon: 12.5,
      date: "2026-05-09",
      arriveBy: "train",
      story: { title: "Roman holiday", text: "Ruins, ruins, and a perfect espresso.", date: "2026-05-09" },
      photos: [],
    },
    {
      place: { kind: "city", id: "cai", name: "Cairo", countryId: "EG", lat: 30.04, lon: 31.24 },
      lat: 30.04,
      lon: 31.24,
      date: "2026-05-20",
      arriveBy: "ferry",
      photos: [{ src: "data:image/png;base64,BBBB", caption: null }],
    },
  ],
};

/** Any absolute/external URL scheme that would mean a network request. data: is inline and allowed. */
const EXTERNAL_URL = /\b(?:https?:|wss?:)\/\//i;

describe("renderReaderHtml (plain journey)", () => {
  const html = renderReaderHtml(journey);

  it("is a complete self-contained HTML document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("</html>");
    // Everything inlined — the reader code and styles ship in the document.
    expect(html).toContain("<style>");
    expect(html).toContain("<script>");
  });

  it("carries the title and a step's story text", () => {
    expect(html).toContain("Three weeks around the Mediterranean");
    // Story text survives into the embedded JSON payload (escaped, inert).
    expect(html).toContain("Ruins, ruins, and a perfect espresso.");
    expect(html).toContain("Paris");
    expect(html).toContain("Cairo");
  });

  it("makes ZERO external references (only inline data: URLs allowed)", () => {
    expect(EXTERNAL_URL.test(html)).toBe(false);
    expect(html).not.toContain("//cdn");
    expect(html).not.toContain("<link");
    // Inline photo data URLs are fine and expected.
    expect(html).toContain("data:image/png;base64,AAAA");
  });

  it("escapes '<' inside the embedded payload so it cannot break the script tag", () => {
    const evil: PublishedJourney = {
      ...journey,
      steps: [
        {
          ...journey.steps[0]!,
          story: { title: "x", text: "</script><script>alert(1)</script>", date: "2026-05-02" },
        },
      ],
    };
    const out = renderReaderHtml(evil);
    // The raw closing-script sequence must never appear verbatim in the payload.
    expect(out).not.toContain("</script><script>alert(1)");
    expect(out).toContain("\\u003c"); // the "<" is escaped
  });

  it("preserves the Natural Earth / OpenStreetMap attribution", () => {
    expect(html).toContain("Natural Earth");
    expect(html).toContain("Published with Postcards");
  });
});

describe("renderReaderHtml (encrypted)", () => {
  it("ships only the envelope — no plaintext of the journey leaks", async () => {
    const env = await encryptJson(journey, "correct horse battery staple");
    const html = renderReaderHtml(null, { encrypted: env });

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(EXTERNAL_URL.test(html)).toBe(false);
    // A passphrase gate, not the content.
    expect(html).toContain("locked");
    expect(html).toContain("pc-env");
    // None of the plaintext (title, subtitle, story text, place names) is present.
    expect(html).not.toContain("Three weeks around the Mediterranean");
    expect(html).not.toContain("Ruins, ruins, and a perfect espresso.");
    expect(html).not.toContain("Roman holiday");
    expect(html).not.toContain("Cairo");
    // The passphrase itself is never written to the file.
    expect(html).not.toContain("correct horse battery staple");
    // The ciphertext envelope is embedded.
    expect(html).toContain(env.ct.slice(0, 16));
  });
});
