// A privacy-local backup reminder: nudges you to export your data when it's
// been a while, so a lost/wiped device doesn't lose your travels. Everything
// here lives in localStorage — no account, no network, no telemetry
// (Constitution: local-first, privacy by default).

const LAST_BACKUP_KEY = "postcards-last-backup";
const SNOOZE_KEY = "postcards-backup-snooze";
const DAY = 24 * 60 * 60 * 1000;

/** Remind again this long after the last real backup, and after a snooze. */
export const BACKUP_INTERVAL_DAYS = 30;
const SNOOZE_DAYS = 7;

function readTime(key: string): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
function writeTime(key: string, ms: number): void {
  try {
    localStorage.setItem(key, String(ms));
  } catch {
    /* private mode: not persisted — the reminder simply won't fire */
  }
}

/** Call when the user exports a FULL backup (the .json restore file). Resets the
 *  clock; a places-only .csv/.md export is a share, not a full backup. */
export function markBackedUp(now: number): void {
  writeTime(LAST_BACKUP_KEY, now);
}

/** Push the next reminder out by the snooze window (the "Later" action). */
export function snoozeReminder(now: number): void {
  writeTime(SNOOZE_KEY, now);
}

/** Whole days since the last full backup, or null if there's never been one. */
export function daysSinceBackup(now: number): number | null {
  const last = readTime(LAST_BACKUP_KEY);
  if (!last) return null;
  return Math.floor((now - last) / DAY);
}

/**
 * Should the reminder show right now? Only when there IS data worth losing, it's
 * been at least BACKUP_INTERVAL_DAYS since the last full backup (or there's
 * never been one), and the reminder hasn't been snoozed within the last week.
 */
export function isBackupDue(hasData: boolean, now: number): boolean {
  if (!hasData) return false;
  if (now - readTime(SNOOZE_KEY) < SNOOZE_DAYS * DAY) return false;
  const last = readTime(LAST_BACKUP_KEY);
  if (!last) return true; // has data, never backed up
  return now - last >= BACKUP_INTERVAL_DAYS * DAY;
}
