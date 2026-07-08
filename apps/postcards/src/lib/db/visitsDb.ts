import { openDB, type IDBPDatabase } from "idb";
import type { Trip, Visit } from "../schema/models";

// On-device working store (Constitution II: local-first, no backend).
const DB_NAME = "postcards";
// v2 adds the "trips" store (Travel Log). Upgrades are additive & idempotent, so
// existing v1 databases keep their visits.
const DB_VERSION = 2;
const STORE = "visits";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Shared handle for every on-device store (visits, trips). */
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
      },
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
 * Replace BOTH visits and trips in a single transaction — used on import so the
 * portable file lands atomically. If any write fails the whole transaction aborts
 * and the previous data is preserved, so the device can never be left with one
 * store from the new file and the other from the old (single-portable-file guarantee).
 */
export async function replaceAllPortable(visits: Visit[], trips: Trip[]): Promise<void> {
  if (!hasIndexedDB()) return;
  const database = await db();
  const tx = database.transaction([STORE, "trips"], "readwrite");
  const visitStore = tx.objectStore(STORE);
  const tripStore = tx.objectStore("trips");
  await visitStore.clear();
  for (const v of visits) await visitStore.put(v);
  await tripStore.clear();
  for (const t of trips) await tripStore.put(t);
  await tx.done;
}
