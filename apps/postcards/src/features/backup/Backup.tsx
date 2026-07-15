import { useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { sortStories, useStories } from "../../lib/store/useStories";
import { getReferenceData } from "../../lib/reference/referenceData";
import { replaceAllPortable } from "../../lib/db/visitsDb";
import { toMarkdown } from "./exportMarkdown";
import { download } from "../../lib/download";
import {
  markBackedUp,
  isBackupDue,
  daysSinceBackup,
  snoozeReminder,
} from "../../lib/backupReminder";

/**
 * Get the file to the user, wherever they want it. Inside the native wrap
 * (iOS/Android) the file is written to the app cache and handed to the system
 * share sheet — Files, Drive, Nextcloud, AirDrop, mail, whatever is installed.
 * On the web we try the same OS share sheet via the Web Share API (mobile
 * browsers), falling back to a plain download on desktop. No proprietary cloud
 * SDK: the OS routes the file to the destination the user picks (zero lock-in).
 * Still strictly explicit — this only ever runs from an Export button.
 */
async function deliver(filename: string, text: string, type: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: filename, url: uri });
    return;
  }
  if (typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
    const file = new File([text], filename, { type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        // The user cancelled the share sheet — done, don't also download.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else (share not really supported): fall through to download.
      }
    }
  }
  download(filename, text, type);
}

export function Backup() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const trips = useTrips((s) => s.trips);
  const stories = useStories((s) => s.stories);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // The reset flow asks you to TYPE a word — a click alone can't wipe everything.
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const RESET_WORD = "RESET";
  const hasData = visits.length > 0 || trips.length > 0 || stories.length > 0;
  // Whether to nudge a backup right now (computed once on open, editable by the
  // export/snooze actions). daysSince is for the wording ("N days" vs "never").
  const [reminderDue, setReminderDue] = useState(() => isBackupDue(hasData, Date.now()));
  const daysSince = daysSinceBackup(Date.now());

  async function exportJson() {
    try {
      // Loaded on click: the codec pulls in the Zod schemas (~65 KB min), which
      // nothing on the startup path needs — keep them out of the boot chunk.
      const { serializeFile, EXPORT_FILENAME } = await import("./exportJson");
      await deliver(EXPORT_FILENAME, serializeFile(visits, trips, stories), "application/json");
      // A full .json export is a real backup — reset the reminder clock.
      markBackedUp(Date.now());
      setReminderDue(false);
    } catch {
      setMessage({ kind: "err", text: "Couldn't build the export file. Your data is unchanged." });
    }
  }
  async function exportMd() {
    try {
      await deliver("places.md", toMarkdown(visits, trips, ref), "text/markdown");
    } catch {
      setMessage({ kind: "err", text: "Couldn't build the summary file. Your data is unchanged." });
    }
  }
  async function exportCsv() {
    try {
      const { serializePlacesCsv, PLACES_CSV_FILENAME } = await import("./exportCsv");
      await deliver(PLACES_CSV_FILENAME, serializePlacesCsv(visits, ref), "text/csv");
    } catch {
      setMessage({ kind: "err", text: "Couldn't build the places file. Your data is unchanged." });
    }
  }

  /** Wipe everything on this device — places, trips, stories and their photos —
   *  in one transaction, then clear it from memory. There is no undo, which is
   *  why it takes a typed word to get here. */
  async function resetAll() {
    try {
      await replaceAllPortable([], [], []);
    } catch {
      setMessage({ kind: "err", text: "Couldn't erase your data — nothing was changed." });
      return;
    }
    useVisits.setState({ visits: [] });
    useTrips.setState({ trips: [] });
    useStories.setState({ stories: [] });
    setResetOpen(false);
    setResetText("");
    setReminderDue(false);
    setMessage({ kind: "ok", text: "All data erased. This device is a clean slate." });
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    // A JSON backup ({…}) is a FULL RESTORE (replaces everything); anything else
    // is treated as a places table (CSV/TSV) and MERGED in. The format is picked
    // from the content, not the extension, so a mislabelled file still works.
    if (text.trimStart().startsWith("{")) {
      await restoreFromJson(text);
    } else {
      await mergeFromCsv(text);
    }
  }

  /** Full restore from a Postcards JSON backup — this REPLACES all of your data,
   *  so it asks first (the one destructive path). */
  async function restoreFromJson(text: string) {
    const { importFile } = await import("./importJson");
    const result = importFile(text);
    if (!result.ok) {
      setMessage({ kind: "err", text: result.error });
      return;
    }
    if (visits.length > 0 || trips.length > 0 || stories.length > 0) {
      const ok = window.confirm(
        `⚠ This replaces everything on this device — your ${visits.length} place` +
          `${visits.length === 1 ? "" : "s"}, ${trips.length} trip${trips.length === 1 ? "" : "s"} and ` +
          `${stories.length} stor${stories.length === 1 ? "y" : "ies"} — with the ` +
          `${result.visits.length} place${result.visits.length === 1 ? "" : "s"}, ` +
          `${result.trips.length} trip${result.trips.length === 1 ? "" : "s"} and ` +
          `${result.stories.length} stor${result.stories.length === 1 ? "y" : "ies"} in this file. ` +
          `It can't be undone. Continue?`,
      );
      if (!ok) return;
    }
    try {
      // Persist all stores in one transaction, then reflect in memory — so the
      // device is never left with places from the new file and trips or stories
      // from the old.
      await replaceAllPortable(result.visits, result.trips, result.stories);
    } catch {
      setMessage({ kind: "err", text: "Import failed while saving; your data is unchanged." });
      return;
    }
    useVisits.setState({ visits: result.visits });
    useTrips.setState({ trips: result.trips });
    useStories.setState({ stories: sortStories(result.stories) });
    setMessage({
      kind: "ok",
      text: `Restored ${result.visits.length} places, ${result.trips.length} trips and ${result.stories.length} stories.`,
    });
  }

  /** Merge a places CSV/TSV — NON-destructive: it adds places and updates ones
   *  you already have; trips, stories and untouched places stay put. */
  async function mergeFromCsv(text: string) {
    const { parsePlacesCsv } = await import("./importCsv");
    const { places, total, skipped } = parsePlacesCsv(text, ref);
    if (places.length === 0) {
      setMessage({
        kind: "err",
        text: total === 0 ? "This file has no places to import." : "Couldn't read any places from this file — expected columns like lat, lon, country, city.",
      });
      return;
    }
    try {
      const { added, updated } = await useVisits.getState().mergeVisits(places);
      const skip = skipped ? `, ${skipped} skipped` : "";
      setMessage({
        kind: "ok",
        text: `Added ${added} place${added === 1 ? "" : "s"}, updated ${updated}${skip}. Your trips and stories are untouched.`,
      });
    } catch {
      setMessage({ kind: "err", text: "Import failed while saving; your data is unchanged." });
    }
  }

  return (
    <section aria-label="Backup and restore">
      <div className="section-head">
        <h2>Your data</h2>
      </div>

      {reminderDue && (
        <div className="backup-reminder" role="status">
          <span aria-hidden>🛟</span>
          <span className="backup-reminder-text">
            {daysSince == null
              ? "You haven't backed up yet — a lost phone loses your travels."
              : `It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since your last backup.`}{" "}
            Export it and keep the file somewhere safe.
          </span>
          <span className="backup-reminder-actions">
            <button className="btn" type="button" onClick={() => void exportJson()}>
              Back up now
            </button>
            <button
              className="link"
              type="button"
              onClick={() => {
                snoozeReminder(Date.now());
                setReminderDue(false);
              }}
            >
              Later
            </button>
          </span>
        </div>
      )}

      <p className="muted">
        Everything lives in one portable file on your device. Export it to a drive or git, or share
        it straight to your cloud (Drive, Nextcloud, Files…). Nothing leaves your device unless you
        export it.
      </p>

      <div className="btn-row">
        <button className="btn" type="button" onClick={() => void exportJson()}>
          Export data
        </button>
        <button className="btn-ghost" type="button" onClick={() => void exportCsv()}>
          Export places (.csv)
        </button>
        <button className="btn-ghost" type="button" onClick={() => void exportMd()}>
          Export summary (.md)
        </button>
        <button className="btn-ghost" type="button" onClick={() => fileInput.current?.click()}>
          Import…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json,text/csv,.csv,.tsv,text/plain"
          onChange={onImport}
          style={{ display: "none" }}
          aria-hidden="true"
        />
      </div>

      {message && (
        <p
          className={
            "notice" + (message.kind === "err" ? " notice-err" : " notice-ok")
          }
          role="status"
        >
          {message.text}
        </p>
      )}
      <p className="muted small">
        Import understands two things. A <strong>.json backup</strong> is a full restore — it{" "}
        <strong>⚠ replaces everything on this device</strong> (you'll be asked to confirm). A{" "}
        <strong>.csv places list</strong> (columns like <code>lat, lon, country, city, been</code>,
        where <code>been</code> tags are <code>been</code> / <code>want</code> / <code>fave</code>){" "}
        is merged in — it only adds and updates places, never erasing your trips or stories. Files
        are validated and sanitized on import — never executed.
      </p>

      {hasData && (
        <div className="danger-zone">
          {!resetOpen ? (
            <>
              <button
                className="btn-danger"
                type="button"
                onClick={() => {
                  setResetText("");
                  setResetOpen(true);
                }}
              >
                Reset all data
              </button>
              <p className="muted small">
                Erases everything on this device. Export a backup first if you might want it back.
              </p>
            </>
          ) : (
            <div className="reset-confirm" role="alertdialog" aria-label="Confirm reset all data">
              <p className="reset-warn">
                <strong>⚠ This erases everything on this device</strong> — your {visits.length} place
                {visits.length === 1 ? "" : "s"}, {trips.length} trip{trips.length === 1 ? "" : "s"}{" "}
                and {stories.length} stor{stories.length === 1 ? "y" : "ies"}, including photos. It
                can't be undone.
              </p>
              <label className="reset-label" htmlFor="reset-confirm-input">
                Type <code>{RESET_WORD}</code> to confirm.
              </label>
              <input
                id="reset-confirm-input"
                className="reset-input"
                type="text"
                value={resetText}
                onChange={(e) => setResetText(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`Type ${RESET_WORD} to confirm erasing all data`}
              />
              <div className="btn-row">
                <button
                  className="btn-danger"
                  type="button"
                  disabled={resetText.trim().toUpperCase() !== RESET_WORD}
                  onClick={() => void resetAll()}
                >
                  Erase everything
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    setResetOpen(false);
                    setResetText("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
