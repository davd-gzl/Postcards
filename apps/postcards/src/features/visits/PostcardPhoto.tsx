import { useEffect, useRef, useState } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { fileToPostcard } from "../../lib/image/downscale";

/**
 * Your own "postcard" photo for a visited place. No photo → a small "Photo"
 * button that opens the camera/library; with a photo → a thumbnail that opens a
 * lightbox to view, replace, or remove. The image is downscaled on-device and
 * stored locally (it only ever leaves the device inside an explicit export).
 */
export function PostcardPhoto({
  visitId,
  photo,
  placeName,
}: {
  visitId: string;
  photo: string | null | undefined;
  placeName: string;
}) {
  const setPhoto = useVisits((s) => s.setPhoto);
  const showToast = useToast((s) => s.show);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the user re-pick the same file later
    if (!file) return;
    setBusy(true);
    try {
      await setPhoto(visitId, await fileToPostcard(file));
    } catch {
      showToast("Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPick}
        aria-hidden
        tabIndex={-1}
      />
      {photo ? (
        <button
          type="button"
          className="postcard-thumb"
          onClick={() => setOpen(true)}
          aria-label={`View your photo of ${placeName}`}
        >
          <img src={photo} alt="" />
        </button>
      ) : (
        <button
          type="button"
          className="mini-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label={`Add a photo for ${placeName}`}
        >
          {busy ? "…" : "📷 Photo"}
        </button>
      )}

      {open && photo && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Your photo of ${placeName}`}
          onClick={() => setOpen(false)}
        >
          <img className="lightbox-img" src={photo} alt={`Your photo of ${placeName}`} />
          <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="mini-btn"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </button>
            <button
              type="button"
              className="link-danger"
              onClick={async () => {
                await setPhoto(visitId, null);
                setOpen(false);
              }}
            >
              Remove
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
