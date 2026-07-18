import { create } from "zustand";
import type { PersistenceState } from "../db/persistence";

// Device-local storage-durability status (NOT part of the portable file — it
// describes THIS device's protection). Drives the Settings "protection" indicator.
// Backup TIMING/nudges are owned by lib/backupReminder.ts (do not duplicate it).

interface PersistenceStore {
  /** Whether the browser granted persistent storage (native ≈ granted). */
  persistence: PersistenceState;
  setPersistence: (p: PersistenceState) => void;
}

export const usePersistence = create<PersistenceStore>((set) => ({
  persistence: "unknown",
  setPersistence: (persistence) => set({ persistence }),
}));
