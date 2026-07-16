import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useStories } from "../../lib/store/useStories";
import { useTrips } from "../../lib/store/useTrips";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useModalKeys } from "../../lib/hooks/useModalKeys";
import { buildJourney, type JourneyInput, type PublishedJourney } from "../../lib/publish/bundle";
import { renderReaderHtml } from "../../lib/publish/renderReader";
import { encryptJson } from "../../lib/publish/encrypt";
import { GitHubTarget } from "../../lib/publish/gitTarget";
import { GitHubConnectorFields, type GitHubConnectorValue } from "../../ui/GitHubConnectorFields";
import { HOSTING_README } from "../../lib/publish/hosting";
import { coordsOf } from "../travel/distance";
import { download } from "../../lib/download";
import { countryFlag, formatDate, formatInt, formatKm } from "../../lib/format/format";
import { MODE_GLYPH } from "../travel/modes";
import { useT } from "../../lib/i18n";
import type { Trip } from "../../lib/schema/models";

type Scope = "all" | "trip" | "folder" | "range";

/** A short human label for a trip in the picker: "✈️ Paris → Rome · 2 May 2026". */
function tripLabel(t: Trip): string {
  const glyph = MODE_GLYPH[t.mode] ?? "•";
  const when = t.date ? ` · ${formatDate(t.date)}` : "";
  return `${glyph} ${t.from.name} → ${t.to.name}${when}`;
}

/**
 * Publish mode — turn a slice of the private journal into a self-contained,
 * read-only travel-blog website you can host ANYWHERE (a folder, a USB stick,
 * GitHub Pages, Netlify, Nextcloud). The app stays the editor; nothing leaves
 * the device except the single file you explicitly export.
 *
 * Everything is derived on-device: the route from your Trips, distance and
 * totals from their coordinates, stories and photos from the Journal. Photos are
 * already re-encoded (no EXIF/GPS). An optional passphrase encrypts the payload
 * so a public host still can't read it. GitHub is ONE optional target behind the
 * always-available local download — remove it and download still works fully.
 */
export function PublishScreen({ onClose }: { onClose: () => void }) {
  const t = useT();
  const ref = useMemo(() => getReferenceData(), []);
  const stories = useStories((s) => s.stories);
  const trips = useTrips((s) => s.trips);
  const visits = useVisits((s) => s.visits);
  const showToast = useToast((s) => s.show);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  useModalKeys(dialogRef, onClose);
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const [scope, setScope] = useState<Scope>("all");
  const [tripId, setTripId] = useState<string>("");
  const [folderName, setFolderName] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [title, setTitle] = useState("My travels");
  const [subtitle, setSubtitle] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  // GitHub connector — one optional target. Token is kept ONLY in memory here
  // (React state) and is never written into the exported bundle.
  const [ghOpen, setGhOpen] = useState(false);
  const [gh, setGh] = useState<GitHubConnectorValue>({
    owner: "",
    repo: "",
    branch: "main",
    token: "",
  });

  // Ordered trips (newest first) for the "one trip" picker.
  const tripOptions = useMemo(
    () => [...trips].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [trips],
  );

  // Distinct trip names ("folders") for the "By trip" scope, sorted for a stable
  // picker. Picking one gathers every leg that shares the name.
  const folders = useMemo(() => {
    const names = new Set<string>();
    for (const tr of trips) {
      const nm = tr.name?.trim();
      if (nm) names.add(nm);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [trips]);
  const folderTripIds = useMemo(
    () => trips.filter((tr) => (tr.name?.trim() ?? "") === folderName).map((tr) => tr.tripId),
    [trips, folderName],
  );

  const resolveCoords: JourneyInput["resolveCoords"] = useMemo(
    () => (place) => coordsOf(place, ref),
    [ref],
  );

  // The live journey for the current selection — the exact "book" that ships.
  const journey: PublishedJourney = useMemo(() => {
    const sel = {
      title: title.trim() || "My travels",
      subtitle: subtitle.trim() || undefined,
      ...(scope === "trip" && tripId ? { tripIds: [tripId] } : {}),
      ...(scope === "folder" && folderName ? { tripIds: folderTripIds } : {}),
      ...(scope === "range" && dateFrom ? { dateFrom } : {}),
      ...(scope === "range" && dateTo ? { dateTo } : {}),
    };
    return buildJourney({ visits, trips, stories, resolveCoords }, sel);
  }, [
    visits,
    trips,
    stories,
    resolveCoords,
    scope,
    tripId,
    folderName,
    folderTripIds,
    dateFrom,
    dateTo,
    title,
    subtitle,
  ]);

  const empty = journey.steps.length === 0;
  const canExport = !empty && !!title.trim() && !busy;

  /** Build the final self-contained HTML (encrypted when a passphrase is set). */
  async function buildHtml(): Promise<string> {
    if (passphrase.trim()) {
      const env = await encryptJson(journey, passphrase);
      return renderReaderHtml(null, { encrypted: env });
    }
    return renderReaderHtml(journey);
  }

  async function onDownload() {
    if (!canExport) return;
    setBusy(true);
    try {
      const html = await buildHtml();
      download("index.html", html, "text/html");
      showToast("Saved index.html — drop it on any host, or open it straight from the folder.");
    } catch {
      showToast("Couldn't build the site. Your data is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function onPushGitHub() {
    if (!canExport) return;
    if (!gh.owner.trim() || !gh.repo.trim() || !gh.branch.trim() || !gh.token.trim()) {
      showToast("Fill in owner, repo, branch and a token to push to GitHub.");
      return;
    }
    setBusy(true);
    try {
      const html = await buildHtml();
      const target = new GitHubTarget({
        owner: gh.owner.trim(),
        repo: gh.repo.trim(),
        branch: gh.branch.trim(),
        token: gh.token.trim(),
      });
      await target.putFiles(
        [
          { path: "index.html", content: html },
          // Ship the host-facing README inside the export (FR-015).
          { path: "README.md", content: HOSTING_README },
        ],
        `Publish "${title.trim()}" via Postcards`,
      );
      showToast(`Pushed to ${gh.owner.trim()}/${gh.repo.trim()} — GitHub Pages will update shortly.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "GitHub push failed. Local download still works.");
    } finally {
      setBusy(false);
    }
  }

  // The plain-journey reader powers the in-modal preview (same code as the
  // export), so what you see is exactly what ships. Encrypted export still uses
  // this journey — the preview just shows it unlocked for you, the author.
  const previewHtml = useMemo(() => (preview ? renderReaderHtml(journey) : ""), [preview, journey]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal publish-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="publish-head">
          <h2 id="publish-title">Publish a shareable site</h2>
          <button className="btn-ghost" type="button" onClick={onClose} aria-label="Close publish">
            Close
          </button>
        </div>

        <p className="muted small">
          Turn a slice of your journal into a self-contained, read-only travel-blog website — a
          cover, a route map, and one photo-led page per stop. It runs offline from a single file
          and makes no network requests.
        </p>

        {/* Scope */}
        <fieldset className="publish-fieldset">
          <legend>What to publish</legend>
          <div className="btn-row" role="radiogroup" aria-label="Publish scope">
            {(
              [
                ["all", t("publish.scope.all")],
                ["trip", t("publish.scope.trip")],
                ["folder", t("publish.scope.byTrip")],
                ["range", t("publish.scope.range")],
              ] as [Scope, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={scope === id}
                className={"mini-btn" + (scope === id ? " on" : "")}
                onClick={() => setScope(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {scope === "trip" && (
            <label className="picker-label" htmlFor="publish-trip">
              Trip
              <select
                id="publish-trip"
                className="select"
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
              >
                <option value="" disabled>
                  {tripOptions.length ? "Pick a trip…" : "No trips logged yet"}
                </option>
                {tripOptions.map((t) => (
                  <option key={t.tripId} value={t.tripId}>
                    {tripLabel(t)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {scope === "folder" && (
            <label className="picker-label" htmlFor="publish-folder">
              {t("publish.byTripLabel")}
              <select
                id="publish-folder"
                className="select"
                value={folderName}
                onChange={(e) => {
                  const name = e.target.value;
                  setFolderName(name);
                  // The site title defaults to the trip name — but never clobber a
                  // title the author has already customised.
                  setTitle((prev) =>
                    !prev.trim() || prev.trim() === "My travels" ? name : prev,
                  );
                }}
              >
                <option value="" disabled>
                  {folders.length ? t("publish.pickFolder") : t("publish.noNamedTrips")}
                </option>
                {folders.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {scope === "range" && (
            <div className="trip-form-row">
              <label className="picker-label" htmlFor="publish-from">
                From
                <input
                  id="publish-from"
                  className="select"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="picker-label" htmlFor="publish-to">
                To
                <input
                  id="publish-to"
                  className="select"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
            </div>
          )}
        </fieldset>

        {/* Details */}
        <fieldset className="publish-fieldset">
          <legend>Cover</legend>
          <label className="picker-label" htmlFor="publish-name">
            Title
            <input
              id="publish-name"
              ref={firstFieldRef}
              className="select"
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Three weeks around the Mediterranean"
            />
          </label>
          <label className="picker-label" htmlFor="publish-sub">
            Subtitle (optional)
            <input
              id="publish-sub"
              className="select"
              type="text"
              maxLength={160}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Ferries, trains & a lot of gelato"
            />
          </label>
        </fieldset>

        {/* Protection */}
        <fieldset className="publish-fieldset">
          <legend>Protection (optional)</legend>
          <label className="picker-label" htmlFor="publish-pass">
            Passphrase
            <input
              id="publish-pass"
              className="select"
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Leave empty for a public site"
            />
          </label>
          <p className="muted small">
            {passphrase.trim()
              ? "The journey is encrypted (AES-GCM) in your browser; visitors must type this passphrase to read it. Share the passphrase separately — it is never written into the file, and a lost passphrase cannot be recovered."
              : "Empty = anyone with the link can read it. Set a passphrase to lock the whole site on a public host."}
          </p>
        </fieldset>

        {/* Live summary */}
        <div className="publish-summary" role="status" aria-live="polite">
          {empty ? (
            <p className="muted small">
              Nothing in this selection yet. Log a trip or a story in scope — an empty site can't be
              built.
            </p>
          ) : (
            <div className="publish-totals">
              <span className="publish-total">
                <strong>{formatInt(journey.totals.places)}</strong>{" "}
                {journey.totals.places === 1 ? "stop" : "stops"}
              </span>
              <span className="publish-total">
                <strong>{formatInt(journey.totals.countries)}</strong>{" "}
                {journey.totals.countries === 1 ? "country" : "countries"}
              </span>
              <span className="publish-total">
                <strong>{formatKm(journey.totals.distanceKm)}</strong> travelled
              </span>
              {journey.dateRange.start && (
                <span className="publish-total publish-total-dates">
                  {formatDate(journey.dateRange.start)}
                  {journey.dateRange.end && journey.dateRange.end !== journey.dateRange.start
                    ? ` – ${formatDate(journey.dateRange.end)}`
                    : ""}
                </span>
              )}
            </div>
          )}
          {!empty && (
            <p className="publish-chips" aria-hidden>
              {journey.steps.slice(0, 8).map((s, i) => (
                <span key={i} className="publish-chip">
                  {countryFlag(s.place.countryId)} {s.place.name}
                </span>
              ))}
              {journey.steps.length > 8 && (
                <span className="publish-chip publish-chip-more">
                  +{journey.steps.length - 8}
                </span>
              )}
            </p>
          )}
        </div>

        <p className="muted small">
          Photos ship inline and were already re-encoded on capture, so no EXIF/GPS or camera data
          is included. Story text and captions are escaped to inert text — a shared page can never
          run a script.
        </p>

        {/* Export */}
        <div className="publish-actions">
          <button className="btn" type="button" disabled={!canExport} onClick={onDownload}>
            {busy ? "Building…" : "⬇ Download index.html"}
          </button>
          <button
            className="btn-ghost"
            type="button"
            disabled={empty}
            aria-pressed={preview}
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? "Hide preview" : "Preview book"}
          </button>
        </div>

        {preview && !empty && (
          <div className="publish-preview">
            <iframe
              title="Preview of the published book"
              className="publish-preview-frame"
              sandbox="allow-scripts"
              srcDoc={previewHtml}
            />
          </div>
        )}

        {/* Optional GitHub connector */}
        <div className="publish-github">
          <button
            className="link"
            type="button"
            aria-expanded={ghOpen}
            onClick={() => setGhOpen((v) => !v)}
          >
            {ghOpen ? "▾" : "▸"} Push to GitHub Pages (optional)
          </button>
          {ghOpen && (
            <div className="publish-github-body">
              <p className="muted small">
                One optional target. Paste a fine-grained token with contents write access; it is
                kept only in memory and never saved or bundled. Download above always works without
                this.
              </p>
              <GitHubConnectorFields
                idPrefix="gh"
                value={gh}
                onChange={setGh}
                repoPlaceholder="my-journey"
              />
              <div className="publish-actions">
                <button className="btn" type="button" disabled={!canExport} onClick={onPushGitHub}>
                  {busy ? "Pushing…" : "Push to GitHub"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
