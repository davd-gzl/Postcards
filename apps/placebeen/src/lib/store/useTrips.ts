import { create } from "zustand";
import type { PlaceRef, TravelMode, Trip } from "../schema/models";
import * as db from "../db/tripsDb";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  async removeTrip(tripId) {
    set({ trips: get().trips.filter((t) => t.tripId !== tripId) });
    await db.deleteTrip(tripId);
  },
  async setAll(trips) {
    set({ trips });
    await db.replaceAllTrips(trips);
  },
}));
