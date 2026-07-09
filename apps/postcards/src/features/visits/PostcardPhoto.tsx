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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null); // the row control (thumb or "Photo")
  const wasOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Modal focus contract: move focus into the dialog on open, restore it to the
  // row control on close (Constitution: keyboard-first, WCAG 2.4.3).
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Escape closes; Tab is trapped within the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const f = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!f || f.length === 0) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
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
          ref={triggerRef}
          type="button"
          className="postcard-thumb"
          onClick={() => setOpen(true)}
          aria-label={`View your photo of ${placeName}`}
        >
          <img src={photo} alt="" />
        </button>
      ) : (
        <button
          ref={triggerRef}
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
          ref={dialogRef}
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
              disabled={busy}
              onClick={async () => {
                await setPhoto(visitId, null);
                setOpen(false);
              }}
            >
              Remove
            </button>
            <button ref={closeRef} type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
