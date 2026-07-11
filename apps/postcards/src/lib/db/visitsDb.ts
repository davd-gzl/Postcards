import { openDB, type IDBPDatabase } from "idb";
import type { Story, Trip, Visit } from "../schema/models";

// On-device working store (Constitution II: local-first, no backend).
const DB_NAME = "postcards";
const LEGACY_DB_NAME = "placebeen"; // the pre-rename database — migrated once
// v2 adds the "trips" store (Travel Log). Upgrades are additive & idempotent, so
// existing v1 databases keep their visits.
// v3 adds the "stories" store (Journal) — additive again; visits and trips are untouched.
const DB_VERSION = 3;
const STORE = "visits";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * One-time carry-over from the pre-rename ("placebeen") database, so users who
 * ran the old build keep their history (Constitution II: the device is the
 * source of truth). Best-effort: never throws, and only runs when the new store
 * is empty, so it can never clobber current data.
 */
async function migrateLegacyDb(target: IDBPDatabase): Promise<void> {
  try {
    if ((await target.count(STORE)) > 0 || (await target.count("trips")) > 0) return;
    if (typeof indexedDB.databases === "function") {
      const names = (await indexedDB.databases()).map((d) => d.name);
      if (!names.includes(LEGACY_DB_NAME)) return; // nothing to migrate
    }
    const legacy = await openDB(LEGACY_DB_NAME); // open at its existing version, no upgrade
    const legacyVisits = legacy.objectStoreNames.contains(STORE)
      ? ((await legacy.getAll(STORE)) as Visit[])
      : [];
    const legacyTrips = legacy.objectStoreNames.contains("trips")
      ? ((await legacy.getAll("trips")) as Trip[])
      : [];
    legacy.close();
    if (legacyVisits.length === 0 && legacyTrips.length === 0) return;
    const tx = target.transaction([STORE, "trips"], "readwrite");
    for (const v of legacyVisits) await tx.objectStore(STORE).put(v);
    for (const t of legacyTrips) await tx.objectStore("trips").put(t);
    await tx.done;
  } catch {
    /* best-effort: a failed migration must never block the app */
  }
}

/** Shared handle for every on-device store (visits, trips, stories). */
export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: "visitId" });
        }
        if (!database.objectStoreNames.contains("trips")) {
          database.createObjectStore("trips", { keyPath: "tripId" });
        }
        if (!database.objectStoreNames.contains("stories")) {
          database.createObjectStore("stories", { keyPath: "storyId" });
        }
      },
    }).then(async (database) => {
      await migrateLegacyDb(database);
      return database;
    });
  }
  return dbPromise;
}

const db = getDb;

export async function getAllVisits(): Promise<Visit[]> {
  if (!hasIndexedDB()) return [];
  return (await db()).getAll(STORE) as Promise<Visit[]>;
}

export async function putVisit(visit: Visit): Promise<void> {
  if (!hasIndexedDB()) return;
  await (await db()).put(STORE, visit);
}

export async function deleteVisit(visitId: string): Promise<void> {
  if (!hasIndexedDB()) return;
  await (await db()).delete(STORE, visitId);
}

export async function replaceAllVisits(visits: Visit[]): Promise<void> {
  if (!hasIndexedDB()) return;
  const database = await db();
  const tx = database.transaction(STORE, "readwrite");
  await tx.store.clear();
  for (const v of visits) await tx.store.put(v);
  await tx.done;
}

/**
 * Replace visits, trips (and, when provided, stories) in a single transaction —
 * used on import so the portable file lands atomically. If any write fails the
 * whole transaction aborts and the previous data is preserved, so the device can
 * never be left with one store from the new file and another from the old
 * (single-portable-file guarantee). `stories` is optional so older 2-argument
 * callers keep working; omitting it leaves the stories store untouched.
 */
export async function replaceAllPortable(
  visits: Visit[],
  trips: Trip[],
  stories?: Story[],
): Promise<void> {
  if (!hasIndexedDB()) return;
  const database = await db();
  const stores = stories ? [STORE, "trips", "stories"] : [STORE, "trips"];
  const tx = database.transaction(stores, "readwrite");
  const visitStore = tx.objectStore(STORE);
  const tripStore = tx.objectStore("trips");
  await visitStore.clear();
  for (const v of visits) await visitStore.put(v);
  await tripStore.clear();
  for (const t of trips) await tripStore.put(t);
  if (stories) {
    const storyStore = tx.objectStore("stories");
    await storyStore.clear();
    for (const s of stories) await storyStore.put(s);
  }
  await tx.done;
}
