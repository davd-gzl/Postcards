import { create } from "zustand";
import { MAX_PHOTOS_PER_VISIT, normalizeVisitPhotos, placeKey } from "../schema/helpers";
import type { Photo, PlaceRef, Visit } from "../schema/models";
import { sanitizeText } from "../schema/sanitize";
import * as db from "../db/visitsDb";
import { uuid } from "./uuid";

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

/**
 * O(1) placeKey → Visit lookups for hot paths that would otherwise scan the
 * whole list per row (Zustand re-runs every subscribed selector on every
 * set(), so hundreds of mounted per-place selectors each paid a linear scan).
 * Cached by array identity: the store replaces `visits` immutably on every
 * set(), so the array reference is a valid cache key, and the WeakMap lets
 * superseded indexes be collected with their arrays.
 */
const idxCache = new WeakMap<Visit[], Map<string, Visit>>();
export function visitIndex(list: Visit[]): Map<string, Visit> {
  let m = idxCache.get(list);
  if (!m) {
    m = new Map(list.map((v) => [placeKey(v.place), v]));
    idxCache.set(list, m);
  }
  return m;
}

/** Today as a local YYYY-MM-DD — the default "visited on" for a new visit. */
function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface VisitsState {
  visits: Visit[];
  loaded: boolean;
  load: () => Promise<void>;
  addVisit: (input: {
    place: PlaceRef;
    date?: string | null;
    note?: string | null;
    status?: Visit["status"];
    favorite?: boolean;
  }) => Promise<Visit>;
  removeVisit: (visitId: string) => Promise<void>;
  /** "+" semantics: none -> visited; wishlist -> becomes visited; visited -> removed. */
  toggleVisit: (place: PlaceRef) => Promise<void>;
  /** "⚑" semantics: none -> wishlist; wishlist -> removed; visited -> untouched. */
  toggleWish: (place: PlaceRef) => Promise<void>;
  /** "★" on an existing record (visited or wishlist). */
  toggleFavorite: (place: PlaceRef) => Promise<void>;
  /** Append a photo to a visit's gallery. */
  addPhoto: (visitId: string, photo: Photo) => Promise<void>;
  /** Append several photos in ONE write — a multi-photo pick must not re-put
   *  the whole (multi-MB) record once per photo. */
  addPhotos: (visitId: string, photos: Photo[]) => Promise<void>;
  /** Remove the photo at `index` from a visit's gallery. */
  removePhoto: (visitId: string, index: number) => Promise<void>;
  /** Set (or clear, with null) the caption on the photo at `index`. */
  setPhotoCaption: (visitId: string, index: number, caption: string | null) => Promise<void>;
  /** Set or clear the visit's own date and/or note (FR-002). */
  setDetails: (visitId: string, details: { date?: string | null; note?: string | null }) => Promise<void>;
  /** Put ONE visit back (single-record undo): upsert by visitId, one write —
   *  setAll would clear and rewrite the entire visits table. */
  restoreVisit: (visit: Visit) => Promise<void>;
  /** Merge imported places into the existing visits, upserting by (kind,id):
   *  a NON-destructive add (trips, stories, and any place not in the file are
   *  untouched; an existing place keeps its photos/note/addedAt). Returns how
   *  many were added vs updated. */
  mergeVisits: (
    incoming: { place: PlaceRef; status: Visit["status"]; favorite?: boolean; date?: string | null }[],
  ) => Promise<{ added: number; updated: number }>;
  setAll: (visits: Visit[]) => Promise<void>;
}

export const useVisits = create<VisitsState>((set, get) => ({
  visits: [],
  loaded: false,
  async load() {
    // Migrate any legacy single-photo records into the `photos` gallery in memory.
    const visits = (await db.getAllVisits()).map(normalizeVisitPhotos);
    set({ visits, loaded: true });
  },
  async addVisit({ place, date = null, note = null, status = "visited", favorite = false }) {
    const existing = findByPlace(get().visits, place);
    const visit: Visit = {
      visitId: existing?.visitId ?? uuid(),
      place,
      status,
      favorite: existing?.favorite ?? favorite,
      // A place marked visited defaults to visited TODAY — usually true, one
      // less thing to fill in, and editable on the place page.
      date: date ?? existing?.date ?? (status === "visited" ? todayISO() : null),
      note: note ?? existing?.note ?? null,
      photos: existing?.photos ?? [], // keep the gallery across re-logs/status changes
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
    if (existing && existing.status === "visited") await get().removeVisit(existing.visitId);
    else await get().addVisit({ place, status: "visited" });
  },
  async toggleWish(place) {
    const existing = findByPlace(get().visits, place);
    if (!existing) {
      await get().addVisit({ place, status: "wishlist" });
    } else if (existing.status === "wishlist") {
      await get().removeVisit(existing.visitId);
    }
    // Already visited: wishing is a no-op — you've been there.
  },
  async toggleFavorite(place) {
    const existing = findByPlace(get().visits, place);
    if (!existing) return;
    const updated: Visit = { ...existing, favorite: !existing.favorite };
    set({ visits: get().visits.map((v) => (v.visitId === updated.visitId ? updated : v)) });
    await db.putVisit(updated);
  },
  async addPhoto(visitId, photo) {
    await get().addPhotos(visitId, [photo]);
  },
  async addPhotos(visitId, photos) {
    const existing = get().visits.find((v) => v.visitId === visitId);
    if (!existing || photos.length === 0) return;
    // Bound the gallery so an export can never exceed the schema's photos cap (which
    // would make buildFile's self-validation throw and block backup entirely).
    const room = MAX_PHOTOS_PER_VISIT - (existing.photos?.length ?? 0);
    if (room <= 0) return;
    const updated: Visit = { ...existing, photos: [...(existing.photos ?? []), ...photos.slice(0, room)] };
    set({ visits: get().visits.map((v) => (v.visitId === visitId ? updated : v)) });
    await db.putVisit(updated);
  },
  async removePhoto(visitId, index) {
    const existing = get().visits.find((v) => v.visitId === visitId);
    if (!existing?.photos) return;
    const updated: Visit = { ...existing, photos: existing.photos.filter((_, i) => i !== index) };
    set({ visits: get().visits.map((v) => (v.visitId === visitId ? updated : v)) });
    await db.putVisit(updated);
  },
  async setPhotoCaption(visitId, index, caption) {
    const existing = get().visits.find((v) => v.visitId === visitId);
    if (!existing?.photos?.[index]) return;
    const photos = existing.photos.map((p, i) =>
      i === index ? { ...p, caption: caption?.trim() ? caption.trim() : null } : p,
    );
    const updated: Visit = { ...existing, photos };
    set({ visits: get().visits.map((v) => (v.visitId === visitId ? updated : v)) });
    await db.putVisit(updated);
  },
  async setDetails(visitId, details) {
    const existing = get().visits.find((v) => v.visitId === visitId);
    if (!existing) return;
    const updated: Visit = {
      ...existing,
      // Only the fields the caller passed change; text is sanitized like the
      // portable file would on import (inert data, same caps).
      ...(details.date !== undefined ? { date: details.date || null } : {}),
      ...(details.note !== undefined
        ? { note: details.note?.trim() ? sanitizeText(details.note, 2000) : null }
        : {}),
    };
    set({ visits: get().visits.map((v) => (v.visitId === visitId ? updated : v)) });
    await db.putVisit(updated);
  },
  async restoreVisit(visit) {
    const exists = get().visits.some((v) => v.visitId === visit.visitId);
    set({
      visits: exists
        ? get().visits.map((v) => (v.visitId === visit.visitId ? visit : v))
        : [...get().visits, visit],
    });
    await db.putVisit(visit);
  },
  async mergeVisits(incoming) {
    const byKey = new Map(get().visits.map((v) => [placeKey(v.place), v]));
    let added = 0;
    let updated = 0;
    for (const item of incoming) {
      const key = placeKey(item.place);
      const existing = byKey.get(key);
      if (existing) {
        byKey.set(key, {
          ...existing,
          place: item.place, // refresh coords/name if the import carries better
          status: item.status,
          favorite: item.favorite ?? existing.favorite,
          date: item.date ?? existing.date,
        });
        updated++;
      } else {
        byKey.set(key, {
          visitId: uuid(),
          place: item.place,
          status: item.status,
          favorite: item.favorite ?? false,
          date: item.date ?? null,
          note: null,
          photos: [],
          addedAt: new Date().toISOString(),
        });
        added++;
      }
    }
    const merged = [...byKey.values()];
    set({ visits: merged });
    await db.replaceAllVisits(merged);
    return { added, updated };
  },
  async setAll(visits) {
    const normalized = visits.map(normalizeVisitPhotos);
    set({ visits: normalized });
    await db.replaceAllVisits(normalized);
  },
}));
