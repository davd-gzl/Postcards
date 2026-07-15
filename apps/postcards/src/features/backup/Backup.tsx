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

/**
 * Get the file to the user. On the web that's a download; inside the native
 * wrap (iOS/Android) an <a download> does nothing useful, so the file is
 * written to the app cache and handed to the system share sheet — Files,
 * AirDrop, mail, drive, wherever the user points it. Still strictly explicit:
 * this only ever runs from the Export buttons.
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
  download(filename, text, type);
}

export function Backup() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const trips = useTrips((s) => s.trips);
  const stories = useStories((s) => s.stories);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function exportJson() {
    try {
      // Loaded on click: the codec pulls in the Zod schemas (~65 KB min), which
      // nothing on the startup path needs — keep them out of the boot chunk.
      const { serializeFile, EXPORT_FILENAME } = await import("./exportJson");
      await deliver(EXPORT_FILENAME, serializeFile(visits, trips, stories), "application/json");
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

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    // Lazy for the same reason as exportJson — the validator is the other Zod user.
    const { importFile } = await import("./importJson");
    const result = importFile(text);
    if (!result.ok) {
      setMessage({ kind: "err", text: result.error });
      return;
    }
    if (visits.length > 0 || trips.length > 0 || stories.length > 0) {
      const ok = window.confirm(
        `Replace your ${visits.length} place${visits.length === 1 ? "" : "s"}, ` +
          `${trips.length} trip${trips.length === 1 ? "" : "s"} and ` +
          `${stories.length} stor${stories.length === 1 ? "y" : "ies"} with the ` +
          `${result.visits.length} place${result.visits.length === 1 ? "" : "s"}, ` +
          `${result.trips.length} trip${result.trips.length === 1 ? "" : "s"} and ` +
          `${result.stories.length} stor${result.stories.length === 1 ? "y" : "ies"} in this file? ` +
          `This can't be undone.`,
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
      text: `Imported ${result.visits.length} places, ${result.trips.length} trips and ${result.stories.length} stories.`,
    });
  }

  return (
    <section aria-label="Backup and restore">
      <div className="section-head">
        <h2>Your data</h2>
      </div>
      <p className="muted">
        Everything lives in one portable file on your device. Export it to a drive or git; import it
        anywhere. Nothing leaves your device unless you export it.
      </p>

      <div className="btn-row">
        <button className="btn" type="button" onClick={() => void exportJson()}>
          Export data
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
          accept="application/json,.json"
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
        Importing replaces your current data. Files are validated and sanitized on import — never
        executed.
      </p>
    </section>
  );
}
