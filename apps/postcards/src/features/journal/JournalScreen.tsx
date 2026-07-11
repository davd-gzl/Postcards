import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useStories } from "../../lib/store/useStories";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { useModalKeys } from "../../lib/hooks/useModalKeys";
import { fileToPostcard } from "../../lib/image/downscale";
import { countryFlag, formatDate } from "../../lib/format/format";
import {
  MAX_PHOTOS_PER_STORY,
  placeKey,
  type Photo,
  type PlaceRef,
  type Story,
} from "../../lib/schema/models";
import { sanitizeText } from "../../lib/schema/sanitize";
import { journalToMarkdown, JOURNAL_EXPORT_FILENAME } from "./exportJournalMd";

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

/** Today as a local YYYY-MM-DD (the composer's default story date). */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The city page serves these kinds — a story's place name links there. */
const CITY_PAGE_KINDS: PlaceRef["kind"][] = ["city", "heritage", "custom"];

/**
 * A story's photo strip in the feed: small thumbnails that open a read-only
 * lightbox to browse (photos are edited in the composer). Same viewer contract
 * as PhotoGallery: Escape closes, arrows page, focus returns to the thumbnail.
 */
function StoryPhotos({ photos, title }: { photos: Photo[]; title: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const count = photos.length;
  const safeIndex = Math.min(index, Math.max(0, count - 1));
  const current = photos[safeIndex];

  // Modal focus contract: focus into the dialog on open, restore to the
  // thumbnail on close (Constitution: keyboard-first, WCAG 2.4.3).
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Escape closes; arrows page; Tab is trapped within the dialog.
  useModalKeys(dialogRef, () => setOpen(false), {
    enabled: open,
    onKey: (e) => {
      if (e.key === "ArrowLeft" && count > 1) {
        setIndex((i) => (i - 1 + count) % count);
        return true;
      }
      if (e.key === "ArrowRight" && count > 1) {
        setIndex((i) => (i + 1) % count);
        return true;
      }
    },
  });

  if (count === 0) return null;
  return (
    <>
      <div className="journal-photos">
        {photos.map((p, i) => (
          <button
            key={i}
            type="button"
            className="journal-thumb"
            aria-label={`View photo ${i + 1} of ${count} — ${title}`}
            onClick={(e) => {
              triggerRef.current = e.currentTarget;
              setIndex(i);
              setOpen(true);
            }}
          >
            <img src={p.src} alt={p.caption ?? ""} />
          </button>
        ))}
      </div>

      {open && current && (
        <div
          className="lightbox"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Photos — ${title}`}
          onClick={() => setOpen(false)}
        >
          <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
            {count > 1 && (
              <button
                type="button"
                className="lightbox-nav prev"
                aria-label="Previous photo"
                onClick={() => setIndex((i) => (i - 1 + count) % count)}
              >
                ‹
              </button>
            )}
            <img className="lightbox-img" src={current.src} alt={current.caption ?? `Photo — ${title}`} />
            {count > 1 && (
              <button
                type="button"
                className="lightbox-nav next"
                aria-label="Next photo"
                onClick={() => setIndex((i) => (i + 1) % count)}
              >
                ›
              </button>
            )}
          </div>

          <div className="lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-meta">
              <span className="journal-lightbox-caption">{current.caption ?? ""}</span>
              {count > 1 && (
                <span className="lightbox-count" aria-hidden>
                  {safeIndex + 1} / {count}
                </span>
              )}
            </div>
            <div className="lightbox-actions">
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

/**
 * Journal — a mini travel blog of the places you've been. Stories are personal
 * data only (title, text, photos), stored on-device and carried in the same
 * portable file as everything else. The feed is newest-first; the composer
 * writes about a place from YOUR visited list.
 */
export function JournalScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const stories = useStories((s) => s.stories);
  const addStory = useStories((s) => s.addStory);
  const updateStory = useStories((s) => s.updateStory);
  const removeStory = useStories((s) => s.removeStory);
  const setAll = useStories((s) => s.setAll);
  const visits = useVisits((s) => s.visits);
  const showToast = useToast((s) => s.show);
  const draftRequest = useUi((s) => s.journalDraftRequest);

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [place, setPlace] = useState<PlaceRef | null>(null);
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  // Places you can write about: your visited list, sorted by name. A prefilled
  // or edited place that's no longer visited is kept as an extra option so the
  // select never shows a phantom value.
  const visitedPlaces = useMemo(
    () =>
      visits
        .filter((v) => v.status === "visited")
        .map((v) => v.place)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [visits],
  );
  const placeOptions = useMemo(
    () =>
      place && !visitedPlaces.some((p) => placeKey(p) === placeKey(place))
        ? [place, ...visitedPlaces]
        : visitedPlaces,
    [visitedPlaces, place],
  );

  function resetForm() {
    setComposerOpen(false);
    setEditingId(null);
    setPlace(null);
    setDate(today());
    setTitle("");
    setText("");
    setPhotos([]);
  }

  function openComposer(prefill?: PlaceRef) {
    setEditingId(null);
    setPlace(prefill ?? null);
    setDate(today());
    setTitle("");
    setText("");
    setPhotos([]);
    setComposerOpen(true);
  }

  function startEdit(s: Story) {
    setEditingId(s.storyId);
    setPlace(s.place);
    setDate(s.date);
    setTitle(s.title);
    setText(s.text);
    setPhotos(s.photos ?? []);
    setComposerOpen(true);
    requestAnimationFrame(() =>
      document.querySelector(".journal-composer")?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  // A "+ Story" tap on a city page opens the composer prefilled with that place.
  // The request is cleared once consumed so revisiting the tab doesn't re-open it.
  useEffect(() => {
    if (!draftRequest) return;
    openComposer(draftRequest.place);
    useUi.setState({ journalDraftRequest: null });
  }, [draftRequest?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes the composer (keyboard-first).
  useEffect(() => {
    if (!composerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") resetForm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerOpen]);

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the user re-pick the same file later
    if (!picked.length) return;
    const room = MAX_PHOTOS_PER_STORY - photos.length;
    if (room <= 0) {
      showToast(`This story is full (${MAX_PHOTOS_PER_STORY} photos).`);
      return;
    }
    const files = picked.slice(0, room);
    setBusy(true);
    try {
      const added: Photo[] = [];
      for (const file of files) {
        added.push({ src: await fileToPostcard(file), caption: null });
      }
      setPhotos((prev) => [...prev, ...added]);
      if (picked.length > room) showToast(`Added ${room} — the story is now full.`);
    } catch {
      showToast("Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Store the SANITIZED text (same transform the portable-file schema applies),
    // so what's saved round-trips: a title like "===" collapses to empty and must
    // not be storable — it would export as "" and the backup would refuse to restore.
    const cleanTitle = sanitizeText(title, 200);
    if (!place || !date || !cleanTitle) return;
    const prev = useStories.getState().stories;
    // Blank captions become null (never stored as empty strings).
    const cleanPhotos = photos.map((p) => ({
      ...p,
      caption: p.caption?.trim() ? p.caption.trim() : null,
    }));
    const fields = { place, date, title: cleanTitle, text: sanitizeText(text, 8000), photos: cleanPhotos };
    if (editingId) {
      await updateStory(editingId, fields);
      showToast(`Updated "${fields.title}"`, () => setAll(prev));
    } else {
      await addStory(fields);
      showToast(`Added "${fields.title}"`, () => setAll(prev));
    }
    resetForm();
  }

  function removeWithUndo(s: Story) {
    const prev = useStories.getState().stories;
    void removeStory(s.storyId);
    showToast(`Removed "${s.title}"`, () => setAll(prev));
  }

  function exportMd() {
    try {
      download(JOURNAL_EXPORT_FILENAME, journalToMarkdown(stories, ref), "text/markdown");
    } catch {
      showToast("Couldn't build the journal file. Your data is unchanged.");
    }
  }

  return (
    <section aria-label="Journal">
      <div className="section-head">
        <h2>Journal</h2>
      </div>

      <div className="btn-row journal-toolbar">
        {!composerOpen && (
          <button className="btn" type="button" onClick={() => openComposer()}>
            ＋ New story
          </button>
        )}
        {stories.length > 0 && (
          <button className="btn-ghost" type="button" onClick={exportMd}>
            Export journal (.md)
          </button>
        )}
      </div>
      {stories.length > 0 && (
        <p className="muted small">
          The Markdown export shares dates, places, titles and text — no photos. A shareable website
          export is planned.
        </p>
      )}

      {composerOpen && (
        <form className="trip-form journal-composer" onSubmit={onSubmit}>
          {editingId && <p className="editing-note">Editing a story</p>}
          <div className="trip-form-row">
            <label className="picker-label" htmlFor="story-place">
              Place
              <select
                id="story-place"
                className="select"
                value={place ? placeKey(place) : ""}
                onChange={(e) =>
                  setPlace(placeOptions.find((p) => placeKey(p) === e.target.value) ?? null)
                }
              >
                <option value="" disabled>
                  {visitedPlaces.length ? "Pick a place you've been…" : "No visited places yet"}
                </option>
                {placeOptions.map((p) => (
                  <option key={placeKey(p)} value={placeKey(p)}>
                    {countryFlag(p.countryId)} {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="picker-label" htmlFor="story-date">
              Date
              <input
                id="story-date"
                className="select"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <label className="picker-label" htmlFor="story-title">
            Title
            <input
              id="story-title"
              className="select"
              type="text"
              maxLength={200}
              placeholder="Three days in the old town…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="picker-label" htmlFor="story-text">
            Story
            <textarea
              id="story-text"
              className="select journal-textarea"
              rows={6}
              maxLength={8000}
              placeholder="What happened, what you ate, who you met…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>

          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onPickPhotos}
            aria-hidden
            tabIndex={-1}
          />
          {photos.length > 0 && (
            <ul className="journal-photo-edit-list">
              {photos.map((p, i) => (
                <li key={i} className="journal-photo-edit">
                  <img src={p.src} alt="" />
                  <input
                    className="caption-input"
                    type="text"
                    maxLength={300}
                    placeholder="Caption (optional)"
                    aria-label={`Caption for photo ${i + 1}`}
                    value={p.caption ?? ""}
                    onChange={(e) =>
                      setPhotos((prev) =>
                        prev.map((q, j) =>
                          j === i ? { ...q, caption: e.target.value || null } : q,
                        ),
                      )
                    }
                  />
                  <button
                    className="link-danger"
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button
              className="mini-btn"
              type="button"
              disabled={busy || photos.length >= MAX_PHOTOS_PER_STORY}
              title={photos.length >= MAX_PHOTOS_PER_STORY ? `Story is full (${MAX_PHOTOS_PER_STORY})` : undefined}
              onClick={() => photoInput.current?.click()}
            >
              {busy ? "…" : "📷 Add photos"}
            </button>
          </div>

          <div className="trip-form-actions">
            <button className="btn" type="submit" disabled={!place || !date || !sanitizeText(title, 200)}>
              {editingId ? "Save changes" : "Save story"}
            </button>
            <button className="btn-ghost" type="button" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {stories.length === 0 ? (
        <p className="muted empty">
          <span className="empty-emoji" aria-hidden>
            ✍️
          </span>
          Your travel journal starts here. Pick a place you've been, give the day a title, and tell
          the story — photos welcome.
        </p>
      ) : (
        <div className="journal-feed">
          {stories.map((s) => (
            <article key={s.storyId} className="journal-card">
              <header className="journal-card-head">
                <time className="journal-date">{formatDate(s.date)}</time>
                <span aria-hidden>·</span>
                {CITY_PAGE_KINDS.includes(s.place.kind) ? (
                  <button
                    className="link journal-place"
                    type="button"
                    onClick={() => useUi.getState().openCity(s.place.id)}
                  >
                    {countryFlag(s.place.countryId)} {s.place.name}
                  </button>
                ) : (
                  <span className="journal-place">
                    {countryFlag(s.place.countryId)} {s.place.name}
                  </span>
                )}
              </header>
              <h3 className="journal-title">{s.title}</h3>
              {s.text && <p className="journal-text">{s.text}</p>}
              <StoryPhotos photos={s.photos ?? []} title={s.title} />
              <footer className="journal-actions">
                <button
                  className="link"
                  type="button"
                  onClick={() => startEdit(s)}
                  aria-label={`Edit story ${s.title}`}
                >
                  Edit
                </button>
                <button
                  className="link-danger"
                  type="button"
                  onClick={() => removeWithUndo(s)}
                  aria-label={`Remove story ${s.title}`}
                >
                  Remove
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
