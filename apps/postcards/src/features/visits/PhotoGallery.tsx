import { useEffect, useRef, useState } from "react";
import { useModalKeys } from "../../lib/hooks/useModalKeys";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { fileToPostcard } from "../../lib/image/downscale";
import { MAX_PHOTOS_PER_VISIT, type Photo } from "../../lib/schema/models";

/**
 * A place's photo gallery — your postcards, the monuments, the views — each with
 * an optional caption. Empty → a small "Photos" button that opens the
 * camera/library; with photos → a thumbnail (+ count) that opens a lightbox to
 * browse, caption, add, or remove. Images are downscaled on-device and stored
 * locally; they only ever leave the device inside an explicit export.
 */
export function PhotoGallery({
  visitId,
  photos,
  placeName,
}: {
  visitId: string;
  photos: Photo[];
  placeName: string;
}) {
  const addPhoto = useVisits((s) => s.addPhoto);
  const removePhoto = useVisits((s) => s.removePhoto);
  const setPhotoCaption = useVisits((s) => s.setPhotoCaption);
  const showToast = useToast((s) => s.show);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);

  const count = photos.length;
  const atCap = count >= MAX_PHOTOS_PER_VISIT;
  const safeIndex = Math.min(index, Math.max(0, count - 1));
  const current = photos[safeIndex];

  // Caption editing uses a local draft (committed on blur/Enter) so spaces aren't
  // eaten by store-side trimming and we don't rewrite the whole (multi-MB) visit
  // to IndexedDB on every keystroke.
  const [draft, setDraft] = useState<string | null>(null);
  const captionValue = draft ?? current?.caption ?? "";
  function commitCaption() {
    if (draft !== null) {
      void setPhotoCaption(visitId, safeIndex, draft);
      setDraft(null);
    }
  }

  // Keep the viewer index valid as photos are added/removed.
  useEffect(() => {
    if (index > count - 1) setIndex(Math.max(0, count - 1));
  }, [count, index]);

  // Discard any uncommitted caption draft when the viewed photo changes.
  useEffect(() => {
    setDraft(null);
  }, [safeIndex, visitId]);

  // Modal focus contract: focus into the dialog on open, restore to the row
  // control on close (Constitution: keyboard-first, WCAG 2.4.3).
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Escape closes; arrows page; Tab is trapped within the dialog.
  useModalKeys(dialogRef, () => setOpen(false), {
    enabled: open,
    selector: "button:not([disabled]), input, textarea",
    onKey: (e) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      // Arrows page between photos — but not while the caption field has focus,
      // where they must move the text cursor.
      if (!typing && e.key === "ArrowLeft" && count > 1) {
        setIndex((i) => (i - 1 + count) % count);
        return true;
      }
      if (!typing && e.key === "ArrowRight" && count > 1) {
        setIndex((i) => (i + 1) % count);
        return true;
      }
    },
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the user re-pick the same file later
    if (!picked.length) return;
    const room = MAX_PHOTOS_PER_VISIT - count;
    if (room <= 0) {
      showToast(`This gallery is full (${MAX_PHOTOS_PER_VISIT} photos).`);
      return;
    }
    const files = picked.slice(0, room);
    setBusy(true);
    try {
      for (const file of files) {
        await addPhoto(visitId, { src: await fileToPostcard(file), caption: null });
      }
      setIndex(count + files.length - 1); // jump to the newest
      setOpen(true);
      if (picked.length > room) showToast(`Added ${room} — the gallery is now full.`);
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
        multiple
        hidden
        onChange={onPick}
        aria-hidden
        tabIndex={-1}
      />
      {count > 0 ? (
        <button
          ref={triggerRef}
          type="button"
          className="postcard-thumb"
          onClick={() => setOpen(true)}
          aria-label={`View ${count} photo${count === 1 ? "" : "s"} of ${placeName}`}
        >
          <img src={photos[0]!.src} alt="" />
          {count > 1 && <span className="postcard-count" aria-hidden>{count}</span>}
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
          {busy ? "…" : "📷 Photos"}
        </button>
      )}

      {open && current && (
        <div
          className="lightbox"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Photos of ${placeName}`}
          onClick={() => setOpen(false)}
        >
          <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
            {count > 1 && (
              <button
                type="button"
                className="lightbox-nav prev"
                aria-label="Previous photo"
                onClick={() => {
                  commitCaption();
                  setIndex((i) => (i - 1 + count) % count);
                }}
              >
                ‹
              </button>
            )}
            <img className="lightbox-img" src={current.src} alt={current.caption ?? `Photo of ${placeName}`} />
            {count > 1 && (
              <button
                type="button"
                className="lightbox-nav next"
                aria-label="Next photo"
                onClick={() => {
                  commitCaption();
                  setIndex((i) => (i + 1) % count);
                }}
              >
                ›
              </button>
            )}
          </div>

          <div className="lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-meta">
              <input
                className="caption-input"
                type="text"
                value={captionValue}
                maxLength={300}
                placeholder="Add a caption (the monument, the view, …)"
                aria-label={`Caption for photo ${safeIndex + 1} of ${placeName}`}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitCaption}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitCaption();
                  }
                }}
              />
              {count > 1 && (
                <span className="lightbox-count" aria-hidden>
                  {safeIndex + 1} / {count}
                </span>
              )}
            </div>
            <div className="lightbox-actions">
              <button
                type="button"
                className="mini-btn"
                disabled={busy || atCap}
                title={atCap ? `Gallery is full (${MAX_PHOTOS_PER_VISIT})` : undefined}
                onClick={() => inputRef.current?.click()}
              >
                ＋ Add
              </button>
              <button
                type="button"
                className="link-danger"
                disabled={busy}
                onClick={async () => {
                  await removePhoto(visitId, safeIndex);
                  if (count <= 1) setOpen(false);
                }}
              >
                Remove
              </button>
              <button ref={closeRef} type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
