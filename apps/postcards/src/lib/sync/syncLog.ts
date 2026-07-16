// The SYNC LOG (spec 013 remediation): a short, on-device history of what each
// sync run did, so the merge's automatic convergence stays TRANSPARENT — the user
// can see exactly what was added/updated/removed, or why a run failed or was
// blocked, without any per-record conflict UI.
//
// Stored on-device only (localStorage), like the rest of the sync config; it is
// never written into the portable file or any export. Entries carry an i18n CODE
// (not a baked-in English sentence) plus interpolation params, so the log renders
// correctly in the current language and stays right if the user switches locale.

const LOG_KEY = "postcards-sync-log";
/** Keep only the most recent runs — the log is a glance, not an audit trail. */
export const SYNC_LOG_MAX = 10;

/** Outcome class of a run. "blocked" is the safety guard stopping a mass-deletion. */
export type SyncLogStatus = "ok" | "error" | "blocked";

export interface SyncLogEntry {
  /** When the run finished (ISO). */
  at: string;
  status: SyncLogStatus;
  /** i18n key suffix under `sync.log.*` (e.g. "changed", "created", "auth"). */
  code: string;
  /** Interpolation values for the message (counts, etc.). */
  params?: Record<string, string | number>;
}

function read(): SyncLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncLogEntry[]) : [];
  } catch {
    return [];
  }
}

/** The recent sync history, newest first. */
export function readSyncLog(): SyncLogEntry[] {
  return read();
}

/** Prepend an entry (newest first) and trim to SYNC_LOG_MAX. Pure over the input
 *  list so it can be unit-tested without localStorage. */
export function withEntry(list: SyncLogEntry[], entry: SyncLogEntry): SyncLogEntry[] {
  return [entry, ...list].slice(0, SYNC_LOG_MAX);
}

/** Record one run's outcome (newest first, capped). Best-effort: a storage failure
 *  (private mode) is swallowed — logging must never break a sync. */
export function appendSyncLog(entry: SyncLogEntry): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(withEntry(read(), entry)));
  } catch {
    /* private mode: history just isn't kept */
  }
}

/** Clear the history (e.g. on disconnect). */
export function clearSyncLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* private mode */
  }
}
