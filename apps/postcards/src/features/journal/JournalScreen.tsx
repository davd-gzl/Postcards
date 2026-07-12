import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import type { City } from "../../lib/reference/types";
import { useStories } from "../../lib/store/useStories";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { useModalKeys } from "../../lib/hooks/useModalKeys";
import { fileToPostcard } from "../../lib/image/downscale";
import { countryFlag, formatDate, formatKm } from "../../lib/format/format";
import { haversineKm } from "../travel/distance";
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

/** A local YYYY-MM-DD, `offset` days from today (0 = today, -1 = yesterday). */
function dayISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
/** Today as a local YYYY-MM-DD (the composer's default story date). */
function today(): string {
  return dayISO(0);
}

/**
 * Near a day boundary, which day is a "daily story" about? Late evening it could
 * be today or the day just starting; small hours it's usually yesterday. Returns
 * the two candidate days to choose between, or null when the day is unambiguous.
 */
function boundaryDays(): { iso: string; hint: string }[] | null {
  const h = new Date().getHours();
  if (h >= 21) {
    return [
      { iso: dayISO(0), hint: "today" },
      { iso: dayISO(1), hint: "the new day" },
    ];
  }
  if (h < 5) {
    return [
      { iso: dayISO(-1), hint: "yesterday" },
      { iso: dayISO(0), hint: "today" },
    ];
  }
  return null;
}

/** The city page serves these kinds — a story's place name links there. */
const CITY_PAGE_KINDS: PlaceRef["kind"][] = ["city", "heritage", "custom"];

/** The feed pages like the other long lists in the app. */
const FEED_PAGE = 20;

/**
 * Composer draft cache: quitting the page must never lose writing, so the
 * text fields are mirrored to localStorage while the composer is open. Photos
 * are deliberately excluded — they are heavy data URLs that would blow the
 * localStorage quota; an edit's photos are rehydrated from the store instead.
 */
const DRAFT_KEY = "postcards-journal-draft";

interface ComposerDraft {
  editingId: string | null;
  place: PlaceRef | null;
  date: string;
  title: string;
  text: string;
}

const PLACE_KINDS: PlaceRef["kind"][] = ["country", "city", "airport", "heritage", "custom"];

/** A malformed, unreadable (private mode) or empty cached draft counts as no draft. */
function loadDraft(): ComposerDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ComposerDraft> | null;
    if (typeof d !== "object" || d === null) return null;
    if (typeof d.date !== "string" || typeof d.title !== "string" || typeof d.text !== "string")
      return null;
    const p = d.place as PlaceRef | null | undefined;
    const place =
      p &&
      typeof p === "object" &&
      PLACE_KINDS.includes(p.kind) &&
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      typeof p.countryId === "string"
        ? p
        : null;
    const editingId = typeof d.editingId === "string" ? d.editingId : null;
    // A blank draft would just pop an empty composer open — not worth restoring.
    if (!d.title.trim() && !d.text.trim() && !place && !editingId) return null;
    return { editingId, place, date: d.date, title: d.title, text: d.text };
  } catch {
    return null;
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private mode */
  }
}

/** How many cities "Near me" suggests. */
const NEARBY_COUNT = 8;

/**
 * Nearest gazetteer cities to a position. The full gazetteer holds ~135k
 * entries, so a cheap bounding-box prefilter keeps haversine off most of them;
 * the box widens once for sparse areas.
 */
function nearestCities(
  here: { lat: number; lon: number },
  cities: City[],
): { city: City; km: number }[] {
  let candidates: City[] = [];
  for (const box of [1.5, 5]) {
    candidates = cities.filter(
      (c) => Math.abs(c.lat - here.lat) <= box && Math.abs(c.lon - here.lon) <= box,
    );
    if (candidates.length >= NEARBY_COUNT) break;
  }
  return candidates
    .map((city) => ({ city, km: haversineKm(here, city) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, NEARBY_COUNT);
}

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
            <img
              className="lightbox-img"
              src={current.src}
              alt={current.caption ?? `Photo — ${title}`}
            />
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
              <button
                ref={closeRef}
                type="button"
                className="btn-ghost"
                onClick={() => setOpen(false)}
              >
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
  const storiesLoaded = useStories((s) => s.loaded);
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
  // A restored editing draft carries no photos (they aren't cached); this holds
  // the story id whose photos still need rehydrating from the store.
  const hydratePhotosFor = useRef<string | null>(null);
  const [nearby, setNearby] = useState<{ city: City; km: number }[] | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [feedShown, setFeedShown] = useState(FEED_PAGE);
  const [dayChoice, setDayChoice] = useState(false);
  // Feed filters: by destination / country, and by year (the "blog" views).
  const [filterSel, setFilterSel] = useState("all");
  const [yearSel, setYearSel] = useState("all");

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

  // Blog views: filter stories by country, by destination, and by year.
  const storyCountries = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stories) {
      const iso2 = s.place.countryId;
      if (iso2 && iso2 !== "ZZ" && !m.has(iso2)) m.set(iso2, ref.countryByIso2(iso2)?.name ?? iso2);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [stories, ref]);
  const storyPlaces = useMemo(() => {
    const m = new Map<string, PlaceRef>();
    for (const s of stories) if (!m.has(placeKey(s.place))) m.set(placeKey(s.place), s.place);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [stories]);
  const storyYears = useMemo(() => {
    const set = new Set<string>();
    for (const s of stories) if (s.date) set.add(s.date.slice(0, 4));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [stories]);
  const filtered = useMemo(() => {
    return stories.filter((s) => {
      if (yearSel === "none" && s.date) return false;
      if (yearSel !== "all" && yearSel !== "none" && s.date?.slice(0, 4) !== yearSel) return false;
      if (filterSel.startsWith("c:")) return s.place.countryId === filterSel.slice(2);
      if (filterSel.startsWith("p:")) return placeKey(s.place) === filterSel.slice(2);
      return true;
    });
  }, [stories, filterSel, yearSel]);

  // Closes the composer without touching the draft cache: Escape/Cancel must
  // not lose writing — the draft comes back on the next visit.
  function resetForm() {
    setComposerOpen(false);
    setEditingId(null);
    setPlace(null);
    setDate(today());
    setTitle("");
    setText("");
    setPhotos([]);
    setNearby(null);
    setGeoMsg(null);
    setDayChoice(false);
  }

  function openComposer(prefill?: PlaceRef, dateStr?: string) {
    setEditingId(null);
    setPlace(prefill ?? null);
    setDate(dateStr ?? today());
    setTitle("");
    setText("");
    setPhotos([]);
    setNearby(null);
    setGeoMsg(null);
    setDayChoice(false);
    setComposerOpen(true);
  }

  // "Daily story": jump straight into today's entry. Near midnight, ask which day
  // it's for first (a late night could be logging the day that just ended).
  function startDailyStory() {
    const days = boundaryDays();
    if (days) setDayChoice(true);
    else openComposer(undefined, today());
  }

  function startEdit(s: Story) {
    setEditingId(s.storyId);
    setPlace(s.place);
    setDate(s.date);
    setTitle(s.title);
    setText(s.text);
    setPhotos(s.photos ?? []);
    setNearby(null);
    setGeoMsg(null);
    setComposerOpen(true);
    requestAnimationFrame(() =>
      document
        .querySelector(".journal-composer")
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  // Restore a cached draft on mount, so quitting the page mid-writing picks up
  // where it left off. A pending "+ Story" prefill from a city page wins.
  useEffect(() => {
    if (useUi.getState().journalDraftRequest) return;
    const draft = loadDraft();
    if (!draft) return;
    setEditingId(draft.editingId);
    setPlace(draft.place);
    setDate(draft.date || today());
    setTitle(draft.title);
    setText(draft.text);
    if (draft.editingId) hydratePhotosFor.current = draft.editingId;
    setComposerOpen(true);
  }, []);

  // Rehydrate a restored edit's photos once stories are loaded — saving with
  // the cache's empty photo list would silently wipe the story's gallery. A
  // story deleted since the draft was cached keeps the writing as a new story.
  useEffect(() => {
    const id = hydratePhotosFor.current;
    if (!id || !storiesLoaded) return;
    hydratePhotosFor.current = null;
    const s = useStories.getState().stories.find((x) => x.storyId === id);
    if (s) setPhotos(s.photos ?? []);
    else setEditingId(null);
  }, [storiesLoaded]);

  // Mirror the draft to localStorage on every change while the composer is
  // open. A blank composer is skipped so opening "New story" doesn't clobber a
  // kept draft before any writing happens.
  useEffect(() => {
    if (!composerOpen) return;
    if (!title.trim() && !text.trim() && !place && !editingId) return;
    const draft: ComposerDraft = { editingId, place, date, title, text };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* private mode: not cached */
    }
  }, [composerOpen, editingId, place, date, title, text]);

  // Geolocation runs ONLY on this tap (privacy: the position is requested on an
  // explicit action, used once to rank suggestions, and never stored). Picking
  // a suggestion just fills the Place field; nothing is logged as visited.
  function findNearby() {
    setGeoMsg(null);
    setNearby(null);
    if (!navigator.geolocation) {
      setGeoMsg("Location is not available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const found = nearestCities(
          { lat: pos.coords.latitude, lon: pos.coords.longitude },
          ref.allCities(),
        );
        if (found.length) setNearby(found);
        else setGeoMsg("No cities found nearby.");
      },
      () => {
        setLocating(false);
        setGeoMsg("Location unavailable. Check the browser permission and try again.");
      },
      { timeout: 10_000, maximumAge: 60_000 },
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
    const fields = {
      place,
      date,
      title: cleanTitle,
      text: sanitizeText(text, 8000),
      photos: cleanPhotos,
    };
    if (editingId) {
      await updateStory(editingId, fields);
      showToast(`Updated "${fields.title}"`, () => setAll(prev));
    } else {
      await addStory(fields);
      showToast(`Added "${fields.title}"`, () => setAll(prev));
    }
    resetForm();
    // The writing is stored; the crash-recovery cache has done its job.
    clearDraft();
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
          <>
            <button className="btn" type="button" onClick={startDailyStory}>
              📔 Today's story
            </button>
            <button className="btn-ghost" type="button" onClick={() => openComposer()}>
              ＋ New story
            </button>
          </>
        )}
        {stories.length > 0 && (
          <button className="btn-ghost" type="button" onClick={exportMd}>
            Export journal (.md)
          </button>
        )}
      </div>
      {dayChoice && !composerOpen && (
        <div className="day-choice" role="group" aria-label="Which day is this story for?">
          <span className="muted small">Which day is this for?</span>
          {boundaryDays()?.map(({ iso, hint }) => (
            <button
              key={iso}
              className="mini-btn"
              type="button"
              onClick={() => openComposer(undefined, iso)}
            >
              {formatDate(iso)} · {hint}
            </button>
          ))}
          <button className="link" type="button" onClick={() => setDayChoice(false)}>
            Cancel
          </button>
        </div>
      )}
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
                onChange={(e) => {
                  setPlace(placeOptions.find((p) => placeKey(p) === e.target.value) ?? null);
                  setNearby(null);
                }}
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
          <div>
            <button className="mini-btn" type="button" disabled={locating} onClick={findNearby}>
              {locating ? "📍 Locating…" : "📍 Near me"}
            </button>{" "}
            <span className="muted small" role="status">
              {geoMsg}
            </span>
          </div>
          {nearby && (
            <div className="btn-row" role="group" aria-label="Cities near you">
              {nearby.map(({ city, km }) => (
                <button
                  key={city.id}
                  className="mini-btn"
                  type="button"
                  aria-label={`Write about ${city.name}, ${formatKm(km)} away`}
                  onClick={() => {
                    // Only fills the Place field — nothing gets marked as visited.
                    setPlace({
                      kind: "city",
                      id: city.id,
                      name: city.name,
                      countryId: city.countryIso2,
                    });
                    setNearby(null);
                    setGeoMsg(null);
                  }}
                >
                  {countryFlag(city.countryIso2)} {city.name} · {formatKm(km)}
                </button>
              ))}
            </div>
          )}
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
              title={
                photos.length >= MAX_PHOTOS_PER_STORY
                  ? `Story is full (${MAX_PHOTOS_PER_STORY})`
                  : undefined
              }
              onClick={() => photoInput.current?.click()}
            >
              {busy ? "…" : "📷 Add photos"}
            </button>
          </div>

          <div className="trip-form-actions">
            <button
              className="btn"
              type="submit"
              disabled={!place || !date || !sanitizeText(title, 200)}
            >
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
        <>
          {stories.length > 1 && (
            <div className="journal-filters">
              <label className="picker-label">
                Show
                <select
                  className="select"
                  value={filterSel}
                  onChange={(e) => {
                    setFilterSel(e.target.value);
                    setFeedShown(FEED_PAGE);
                  }}
                >
                  <option value="all">All destinations</option>
                  {storyCountries.length > 0 && (
                    <optgroup label="By country">
                      {storyCountries.map(([iso2, name]) => (
                        <option key={iso2} value={`c:${iso2}`}>
                          {countryFlag(iso2)} {name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {storyPlaces.length > 1 && (
                    <optgroup label="By destination">
                      {storyPlaces.map((p) => (
                        <option key={placeKey(p)} value={`p:${placeKey(p)}`}>
                          {countryFlag(p.countryId)} {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {storyYears.length > 0 && (
                <label className="picker-label">
                  When
                  <select
                    className="select"
                    value={yearSel}
                    onChange={(e) => {
                      setYearSel(e.target.value);
                      setFeedShown(FEED_PAGE);
                    }}
                  >
                    <option value="all">Any year</option>
                    {storyYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                    <option value="none">No date</option>
                  </select>
                </label>
              )}
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="muted empty">
              No stories match this filter.{" "}
              <button
                className="link"
                type="button"
                onClick={() => {
                  setFilterSel("all");
                  setYearSel("all");
                }}
              >
                Clear filters
              </button>
            </p>
          ) : (
          <>
          <div className="journal-feed">
            {filtered.slice(0, feedShown).map((s) => (
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
          {filtered.length > feedShown && (
            <div className="list-pager">
              <span className="muted small">
                Showing {feedShown} of {filtered.length}
              </span>
              <button
                className="mini-btn"
                type="button"
                onClick={() => setFeedShown((n) => n + FEED_PAGE)}
              >
                Show {Math.min(FEED_PAGE, filtered.length - feedShown)} more
              </button>
            </div>
          )}
          </>
          )}
        </>
      )}
    </section>
  );
}
