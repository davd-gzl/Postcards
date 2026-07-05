import { openDB, type IDBPDatabase } from "idb";
import type { Visit } from "../schema/models";

// On-device working store (Constitution II: local-first, no backend).
const DB_NAME = "placebeen";
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
