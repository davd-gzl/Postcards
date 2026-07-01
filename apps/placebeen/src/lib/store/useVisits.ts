import { create } from "zustand";
import { placeKey, type PlaceRef, type Visit } from "../schema/models";
import * as db from "../db/visitsDb";

/**
 * Pure dedupe/upsert: at most one visit per (kind, id) (FR-015).
 * Re-logging a place updates the existing record instead of duplicating.
 * Exported for unit testing without IndexedDB.
 */
export function dedupeUpsert(list: Visit[], visit: Visit): Visit[] {
  const key = placeKey(visit.place);
  const idx = list.findIndex((v) => placeKey(v.place) === key);
  if (idx === -1) return [...list, visit];
  const next = list.slice();
  next[idx] = { ...visit, visitId: list[idx]!.visitId, addedAt: list[idx]!.addedAt };
  return next;
}

export function findByPlace(list: Visit[], place: Pick<PlaceRef, "kind" | "id">): Visit | undefined {
  const key = placeKey(place);
  return list.find((v) => placeKey(v.place) === key);
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback (non-secure) — only used where crypto is unavailable.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface VisitsState {
  visits: Visit[];
  loaded: boolean;
  load: () => Promise<void>;
  addVisit: (input: { place: PlaceRef; date?: string | null; note?: string | null }) => Promise<Visit>;
  removeVisit: (visitId: string) => Promise<void>;
  toggleVisit: (place: PlaceRef) => Promise<void>;
  setAll: (visits: Visit[]) => Promise<void>;
}

export const useVisits = create<VisitsState>((set, get) => ({
  visits: [],
  loaded: false,
  async load() {
    const visits = await db.getAllVisits();
    set({ visits, loaded: true });
  },
  async addVisit({ place, date = null, note = null }) {
    const existing = findByPlace(get().visits, place);
    const visit: Visit = {
      visitId: existing?.visitId ?? uuid(),
      place,
      date: date ?? null,
      note: note ?? null,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
    };
    set({ visits: dedupeUpsert(get().visits, visit) });
    await db.putVisit(visit);
    return visit;
  },
  async removeVisit(visitId) {
    set({ visits: get().visits.filter((v) => v.visitId !== visitId) });
    await db.deleteVisit(visitId);
  },
  async toggleVisit(place) {
    const existing = findByPlace(get().visits, place);
    if (existing) await get().removeVisit(existing.visitId);
    else await get().addVisit({ place });
  },
  async setAll(visits) {
    set({ visits });
    await db.replaceAllVisits(visits);
  },
}));
