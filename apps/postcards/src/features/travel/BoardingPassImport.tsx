import { useRef, useState } from "react";
import { parseBcbp, type BcbpResult } from "../../lib/bcbp/parse";

// Read a boarding pass: scan its barcode from a photo (where the browser's
// BarcodeDetector supports PDF417/Aztec/QR) or paste the code. Everything is
// parsed on-device — the ticket never leaves the phone.

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}
function getDetectorCtor(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return typeof window !== "undefined" && w.BarcodeDetector ? w.BarcodeDetector : null;
}

export function BoardingPassImport({ onResult }: { onResult: (r: BcbpResult) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canScan = getDetectorCtor() !== null;

  function apply(raw: string) {
    const result = parseBcbp(raw);
    if (!result) {
      setError("That doesn't look like a boarding-pass code. Paste the full code, or try a clearer photo.");
      return;
    }
    setError(null);
    setText("");
    setOpen(false);
    onResult(result);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const Ctor = getDetectorCtor();
    if (!Ctor) return;
    try {
      const formats = (await Ctor.getSupportedFormats?.()) ?? [];
      const want = ["pdf417", "aztec", "qr_code"].filter((f) => formats.includes(f));
      const detector = new Ctor(want.length ? { formats: want } : undefined);
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      const raw = codes[0]?.rawValue;
      if (!raw) {
        setError("Couldn't read a barcode in that photo — try a sharper, straight-on shot.");
        return;
      }
      apply(raw);
    } catch {
      setError("Couldn't scan that photo on this device. You can paste the code instead.");
    }
  }

  if (!open) {
    return (
      <button className="btn-ghost pass-open" type="button" onClick={() => setOpen(true)}>
        ✈ Add from a boarding pass
      </button>
    );
  }

  return (
    <div className="pass-panel">
      <div className="pass-panel-head">
        <strong>From a boarding pass</strong>
        <button className="link" type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {canScan && (
        <>
          <button className="btn-ghost" type="button" onClick={() => fileRef.current?.click()}>
            📷 Scan a photo of the pass
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhoto}
            style={{ display: "none" }}
            aria-hidden="true"
          />
          <p className="muted small">or paste the code below</p>
        </>
      )}
      <label className="picker-label" htmlFor="pass-code">
        Boarding-pass code
        <textarea
          id="pass-code"
          className="pass-textarea"
          rows={2}
          placeholder="M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button className="btn" type="button" disabled={!text.trim()} onClick={() => apply(text)}>
        Read pass
      </button>
      {error && (
        <p className="notice notice-err" role="status">
          {error}
        </p>
      )}
      <p className="muted small">
        Parsed on your device — the ticket is never uploaded. We read the from/to airports and date.
      </p>
    </div>
  );
}
