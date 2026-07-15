import { describe, it, expect, beforeEach } from "vitest";
import {
  markBackedUp,
  isBackupDue,
  daysSinceBackup,
  snoozeReminder,
  BACKUP_INTERVAL_DAYS,
} from "../../src/lib/backupReminder";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("backup reminder (privacy-local)", () => {
  beforeEach(() => localStorage.clear());

  it("never nudges when there is no data", () => {
    expect(isBackupDue(false, NOW)).toBe(false);
  });

  it("nudges when there is data and no backup has ever happened", () => {
    expect(isBackupDue(true, NOW)).toBe(true);
    expect(daysSinceBackup(NOW)).toBeNull();
  });

  it("goes quiet right after a backup, and returns after the interval", () => {
    markBackedUp(NOW);
    expect(isBackupDue(true, NOW)).toBe(false);
    expect(daysSinceBackup(NOW + 3 * DAY)).toBe(3);
    expect(isBackupDue(true, NOW + (BACKUP_INTERVAL_DAYS - 1) * DAY)).toBe(false);
    expect(isBackupDue(true, NOW + (BACKUP_INTERVAL_DAYS + 1) * DAY)).toBe(true);
  });

  it("stays quiet through the snooze window, then nudges again", () => {
    snoozeReminder(NOW);
    expect(isBackupDue(true, NOW + 2 * DAY)).toBe(false);
    expect(isBackupDue(true, NOW + 8 * DAY)).toBe(true);
  });
});
