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
  URL.revokeObjectURL(url);
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
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const text = await file.text();
    const result = importFile(text);
    if (!result.ok) {
      setMessage({ kind: "err", text: result.error });
      return;
    }
    await setAll(result.visits);
    setMessage({ kind: "ok", text: `Imported ${result.visits.length} visits.` });
  }

  return (
    <div className="panel">
      <h2>Backup &amp; restore</h2>
      <p className="muted">
        Everything lives in one portable file on your device. Export it to a drive or git; import
        it anywhere. Nothing leaves your device unless you export it.
      </p>

      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="btn" type="button" onClick={exportJson}>
          Export data (JSON)
        </button>
        <button className="btn secondary" type="button" onClick={exportMd}>
          Export map (Markdown)
        </button>
        <button className="btn secondary" type="button" onClick={() => fileInput.current?.click()}>
          Import file…
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
        <p className="notice" role="status" style={message.kind === "err" ? { color: "var(--danger)" } : undefined}>
          {message.text}
        </p>
      )}

      <p className="notice">
        Importing replaces your current data with the file’s contents. Files are validated and
        sanitized on import — never executed.
      </p>
    </div>
  );
}
