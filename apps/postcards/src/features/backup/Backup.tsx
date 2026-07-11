import { useMemo, useRef, useState } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { getReferenceData } from "../../lib/reference/referenceData";
import { replaceAllPortable } from "../../lib/db/visitsDb";
import { serializeFile, EXPORT_FILENAME } from "./exportJson";
import { toMarkdown } from "./exportMarkdown";
import { importFile } from "./importJson";

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke after the click has a chance to start the download (revoking
  // synchronously can cancel it in some browsers).
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function Backup() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const trips = useTrips((s) => s.trips);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function exportJson() {
    try {
      download(EXPORT_FILENAME, serializeFile(visits, trips), "application/json");
    } catch {
      setMessage({ kind: "err", text: "Couldn't build the export file. Your data is unchanged." });
    }
  }
  function exportMd() {
    try {
      download("places.md", toMarkdown(visits, trips, ref), "text/markdown");
    } catch {
      setMessage({ kind: "err", text: "Couldn't build the summary file. Your data is unchanged." });
    }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const result = importFile(text);
    if (!result.ok) {
      setMessage({ kind: "err", text: result.error });
      return;
    }
    if (visits.length > 0 || trips.length > 0) {
      const ok = window.confirm(
        `Replace your ${visits.length} place${visits.length === 1 ? "" : "s"} and ` +
          `${trips.length} trip${trips.length === 1 ? "" : "s"} with the ` +
          `${result.visits.length} place${result.visits.length === 1 ? "" : "s"} and ` +
          `${result.trips.length} trip${result.trips.length === 1 ? "" : "s"} in this file? ` +
          `This can't be undone.`,
      );
      if (!ok) return;
    }
    try {
      // Persist both stores in one transaction, then reflect in memory — so the
      // device is never left with places from the new file and trips from the old.
      await replaceAllPortable(result.visits, result.trips);
    } catch {
      setMessage({ kind: "err", text: "Import failed while saving; your data is unchanged." });
      return;
    }
    useVisits.setState({ visits: result.visits });
    useTrips.setState({ trips: result.trips });
    setMessage({
      kind: "ok",
      text: `Imported ${result.visits.length} places and ${result.trips.length} trips.`,
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
        <button className="btn" type="button" onClick={exportJson}>
          Export data
        </button>
        <button className="btn-ghost" type="button" onClick={exportMd}>
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
