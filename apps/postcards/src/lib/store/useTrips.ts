import { create } from "zustand";
import type { PlaceRef, TravelMode, Trip } from "../schema/models";
import * as db from "../db/tripsDb";
import { uuid } from "./uuid";

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
    const trips = await db.getAllTrips();
    set({ trips, loaded: true });
  },
  async addTrip({ from, to, mode = "flight", date = null, carrier = null, note = null }) {
    const trip: Trip = {
      tripId: uuid(),
      from,
      to,
      mode,
      date,
      carrier,
      note,
      addedAt: new Date().toISOString(),
    };
    set({ trips: [...get().trips, trip] });
    await db.putTrip(trip);
    return trip;
  },
  async updateTrip(tripId, changes) {
    const existing = get().trips.find((t) => t.tripId === tripId);
    if (!existing) return;
    const updated: Trip = { ...existing, ...changes };
    set({ trips: get().trips.map((t) => (t.tripId === tripId ? updated : t)) });
    await db.putTrip(updated);
  },
  async removeTrip(tripId) {
    set({ trips: get().trips.filter((t) => t.tripId !== tripId) });
    await db.deleteTrip(tripId);
  },
  async setAll(trips) {
    set({ trips });
    await db.replaceAllTrips(trips);
  },
}));
