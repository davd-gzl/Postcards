import { create } from "zustand";
import { appendSyncLog, readSyncLog, clearSyncLog, type SyncLogEntry } from "../sync/syncLog";
import { readLastSynced, writeLastSynced } from "../sync/syncConfig";

// Reactive view of sync activity (spec 013) so the Sync settings section updates
// live — whether a run was started by the user's "Sync now" button or by
// background auto-sync. The durable state (the log, the last-synced stamp) lives in
// localStorage (on-device only); this store mirrors it for React and is the single
// source of truth for the "busy" indicator, so manual and auto runs share one
// spinner and can't both run a UI into an inconsistent state.

interface SyncStatusState {
  /** Recent run history, newest first (mirrors the on-device log). */
  log: SyncLogEntry[];
  /** ISO stamp of the last successful sync, or "" if never. */
  lastSynced: string;
  /** True while any sync run (manual or auto) is in flight. */
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** Persist + record one run's outcome, refreshing the reactive log. */
  record: (entry: SyncLogEntry) => void;
  /** Persist + reflect a successful sync's timestamp. */
  markSynced: (iso: string) => void;
  /** Forget the history + last-synced stamp (on Disconnect). */
  reset: () => void;
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  log: readSyncLog(),
  lastSynced: readLastSynced(),
  busy: false,
  setBusy: (busy) => set({ busy }),
  record: (entry) => {
    appendSyncLog(entry);
    set({ log: readSyncLog() });
  },
  markSynced: (iso) => {
    writeLastSynced(iso);
    set({ lastSynced: iso });
  },
  reset: () => {
    clearSyncLog();
    set({ log: [], lastSynced: "" });
  },
}));
