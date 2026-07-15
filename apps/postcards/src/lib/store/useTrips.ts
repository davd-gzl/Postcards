import { create } from "zustand";
import { backfillUpdatedAt } from "../schema/helpers";
import type { PlaceRef, TravelMode, Trip } from "../schema/models";
import * as db from "../db/tripsDb";
import * as visitsDb from "../db/visitsDb";
import { uuid } from "./uuid";

/** Now, as the ISO stamp written to `updatedAt` on every mutating path (spec 013). */
const stampNow = () => new Date().toISOString();

interface TripsState {
  trips: Trip[];
  loaded: boolean;
  load: () => Promise<void>;
  addTrip: (input: {
    from: PlaceRef;
    to: PlaceRef;
    mode?: TravelMode;
    date?: string | null;
    carrier?: string | null;
    note?: string | null;
  }) => Promise<Trip>;
  updateTrip: (
    tripId: string,
    changes: Partial<Pick<Trip, "from" | "to" | "mode" | "date" | "carrier" | "note">>,
  ) => Promise<void>;
  removeTrip: (tripId: string) => Promise<void>;
  setAll: (trips: Trip[]) => Promise<void>;
}

export const useTrips = create<TripsState>((set, get) => ({
  trips: [],
  loaded: false,
  async load() {
    // Backfill `updatedAt` from `addedAt` for trips made before sync existed.
    const trips = (await db.getAllTrips()).map(backfillUpdatedAt);
    set({ trips, loaded: true });
  },
  async addTrip({ from, to, mode = "flight", date = null, carrier = null, note = null }) {
    const at = new Date().toISOString();
    const trip: Trip = {
      tripId: uuid(),
      from,
      to,
      mode,
      date,
      carrier,
      note,
      addedAt: at,
      updatedAt: at,
    };
    set({ trips: [...get().trips, trip] });
    await db.putTrip(trip);
    return trip;
  },
  async updateTrip(tripId, changes) {
    const existing = get().trips.find((t) => t.tripId === tripId);
    if (!existing) return;
    const updated: Trip = { ...existing, ...changes, updatedAt: stampNow() };
    set({ trips: get().trips.map((t) => (t.tripId === tripId ? updated : t)) });
    await db.putTrip(updated);
  },
  async removeTrip(tripId) {
    set({ trips: get().trips.filter((t) => t.tripId !== tripId) });
    await db.deleteTrip(tripId);
    // Tombstone the deletion so it propagates on sync (spec 013, FR-009).
    await visitsDb.putTombstone("trip", tripId, stampNow());
  },
  async setAll(trips) {
    // Bulk load: backfill `updatedAt` without stamping "now" (keep real ages).
    const backfilled = trips.map(backfillUpdatedAt);
    set({ trips: backfilled });
    await db.replaceAllTrips(backfilled);
  },
}));
