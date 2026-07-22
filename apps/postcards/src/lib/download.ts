/** Trigger a browser download of `blob` as `filename`. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke after the click has a chance to start the download (revoking
  // synchronously can cancel it in some browsers).
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Trigger a browser download of `text` as `filename`, tagged with MIME `type`. */
export function download(filename: string, text: string, type: string) {
  downloadBlob(filename, new Blob([text], { type }));
}
