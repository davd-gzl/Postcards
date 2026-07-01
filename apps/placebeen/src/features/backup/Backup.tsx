import { useMemo, useRef, useState } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { getReferenceData } from "../../lib/reference/referenceData";
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
  const setAll = useVisits((s) => s.setAll);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function exportJson() {
    download(EXPORT_FILENAME, serializeFile(visits), "application/json");
  }
  function exportMd() {
    download("places.md", toMarkdown(visits, ref), "text/markdown");
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
    await setAll(result.visits);
    setMessage({ kind: "ok", text: `Imported ${result.visits.length} places.` });
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
          Export map (.md)
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
        <p className={"notice" + (message.kind === "err" ? " notice-err" : "")} role="status">
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
