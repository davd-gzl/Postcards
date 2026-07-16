import { create } from "zustand";
import { openDB } from "idb";
import type { City } from "../reference/types";
import { setPackPlaces } from "../reference/referenceData";
import { uuid } from "../store/uuid";
import { parsePack, toRawGitHubUrl, type InstalledPack } from "./schema";

// Installed community data packs live in their own tiny IndexedDB, separate from
// the personal journal store — a pack is REFERENCE data, not user data, and
// removing all packs never touches your visits/journal.
const DB_NAME = "postcards-packs";
const STORE = "packs";

function db() {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
    },
  });
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Flatten a pack's places into the reference `City` shape, with namespaced ids
 *  (pack:<packId>:<n>) so they never collide with GeoNames ids. */
function packToCities(p: InstalledPack): City[] {
  return p.pack.places.map((pl, i) => ({
    id: `pack:${p.id}:${pl.id ?? i}`,
    name: pl.name,
    countryIso2: pl.countryIso2,
    subdivisionId: null,
    lat: pl.lat,
    lon: pl.lon,
    population: null,
  }));
}

/** Push every installed pack's places into the reference singleton (search + map). */
function applyAll(packs: InstalledPack[]): void {
  setPackPlaces(packs.flatMap(packToCities));
}

export interface AddResult {
  ok: boolean;
  error?: string;
  name?: string;
  count?: number;
}

interface DataPacksState {
  packs: InstalledPack[];
  loaded: boolean;
  load: () => Promise<void>;
  addFromText: (text: string, sourceUrl: string | null) => Promise<AddResult>;
  addFromUrl: (url: string) => Promise<AddResult>;
  remove: (id: string) => Promise<void>;
}

export const useDataPacks = create<DataPacksState>((set, get) => ({
  packs: [],
  loaded: false,

  async load() {
    if (!hasIndexedDB()) {
      set({ loaded: true });
      return;
    }
    let packs: InstalledPack[] = [];
    try {
      packs = (await (await db()).getAll(STORE)) as InstalledPack[];
    } catch {
      /* no packs / storage unavailable */
    }
    applyAll(packs);
    set({ packs, loaded: true });
  },

  async addFromText(text, sourceUrl) {
    const parsed = parsePack(text);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const installed: InstalledPack = {
      id: uuid(),
      addedAt: new Date().toISOString(),
      sourceUrl,
      pack: parsed.pack,
    };
    if (hasIndexedDB()) {
      try {
        await (await db()).put(STORE, installed);
      } catch {
        return { ok: false, error: "Couldn't save the pack on this device." };
      }
    }
    const packs = [...get().packs, installed];
    applyAll(packs);
    set({ packs });
    return { ok: true, name: parsed.pack.name, count: parsed.pack.places.length };
  },

  async addFromUrl(url) {
    // Only GitHub-raw is fetched directly — the CSP connect-src allows exactly
    // those hosts, never arbitrary ones. Anything else: download + import a file.
    const raw = toRawGitHubUrl(url);
    if (!raw) {
      return {
        ok: false,
        error:
          "Only github.com / raw.githubusercontent.com / gist links are fetched directly. For any other host, download the file and use Import file.",
      };
    }
    let text: string;
    try {
      const res = await fetch(raw, { referrerPolicy: "no-referrer", credentials: "omit" });
      if (!res.ok) return { ok: false, error: `Couldn't fetch the pack (${res.status}).` };
      text = await res.text();
    } catch {
      return { ok: false, error: "Couldn't fetch the pack. Check the link and your connection." };
    }
    return get().addFromText(text, raw);
  },

  async remove(id) {
    if (hasIndexedDB()) {
      try {
        await (await db()).delete(STORE, id);
      } catch {
        /* already gone */
      }
    }
    const packs = get().packs.filter((p) => p.id !== id);
    applyAll(packs);
    set({ packs });
  },
}));
