// Web Worker: fetch, parse, fold and sort the FULL world gazetteer (~17 MB of
// JSON, ~135k cities) completely off the main thread. Doing this on the main
// thread froze the UI for over a second right after startup — exactly when the
// user starts interacting with the map. The worker posts back ready-to-index
// rows (search string precomputed, population-sorted), so the main thread only
// swaps arrays.
import type { City } from "./types";

/** Same folding referenceData uses: diacritics off, lowercase. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<string>) => void) | null;
  postMessage: (m: unknown) => void;
};

ctx.onmessage = (e: MessageEvent<string>) => {
  void (async () => {
    try {
      const res = await fetch(e.data);
      if (!res.ok) {
        ctx.postMessage(null);
        return;
      }
      const cities = (await res.json()) as City[];
      const prepared = cities
        .map((c) => ({ ...c, search: normalize(c.name) }))
        .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
      ctx.postMessage(prepared);
    } catch {
      ctx.postMessage(null); // offline / interrupted: the core set keeps working
    }
  })();
};
