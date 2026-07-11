import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useModalKeys } from "../../lib/hooks/useModalKeys";
import { guidesFor, fetchSummary, searchUrl, type WikivoyageSummary } from "../../lib/wikivoyage";
import type { PlaceRef } from "../../lib/schema/models";

const KIND_GROUP: Record<string, string> = {
  place: "Explore",
  country: "Explore",
  understand: "Understand the country",
  phrasebook: "Language & alphabet",
};
const GROUP_ORDER = ["Explore", "Understand the country", "Language & alphabet"];

/**
 * A "📖 Guide" affordance for a place. Opens a modal of Wikivoyage guides —
 * the city & country travel guides, the country overview, and a phrasebook per
 * spoken language (phrases + the alphabet). All links work offline; a short
 * article overview is fetched only when the user explicitly asks (online, opt-in,
 * with attribution — Constitution: privacy by default, aggregator not author).
 */
export function GuideButton({ place, className }: { place: PlaceRef; className?: string }) {
  const ref = useMemo(() => getReferenceData(), []);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Country & city names — everything else (the guide links) is built inside the
  // modal, so rows with a closed modal do no guide work at all. Use the COMMON
  // country name (the real Wikivoyage article title, e.g. "Russia") rather than
  // the ISO-official name ("Russian Federation"), which would 404.
  const country = ref.countryByIso2(place.countryId);
  const countryName = country ? ref.articleNameOf(country.iso2) : place.countryId;
  const cityName =
    place.kind === "city" ? ref.cityById(place.id)?.name ?? place.name : undefined;

  if (!country) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className ?? "mini-btn"}
        onClick={() => setOpen(true)}
        aria-label={`Travel guides for ${place.name}`}
        title={`Travel guides for ${place.name}`}
      >
        📖 Guide
      </button>
      {open && (
        <GuidesModal
          placeName={place.name}
          summaryTitle={cityName ?? countryName}
          searchQuery={cityName ? `${cityName} ${countryName}` : countryName}
          cityName={cityName}
          countryName={countryName}
          countryIso2={country.iso2}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

function GuidesModal({
  placeName,
  summaryTitle,
  searchQuery,
  cityName,
  countryName,
  countryIso2,
  onClose,
}: {
  placeName: string;
  summaryTitle: string;
  searchQuery: string;
  cityName: string | undefined;
  countryName: string;
  countryIso2: string;
  onClose: () => void;
}) {
  const ref = useMemo(() => getReferenceData(), []);
  // Built only while the modal is open — closed Guide buttons cost nothing.
  const links = useMemo(
    () =>
      guidesFor({
        cityName,
        countryName,
        countryIso2,
        languages: ref.languagesOf(countryIso2),
      }),
    [ref, cityName, countryName, countryIso2],
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Overviews are SAVED on-device once loaded, so they reopen offline.
  const key = (proj: string) => `postcards-guide:${proj}:${summaryTitle}`;
  const readSaved = (proj: string): WikivoyageSummary | null => {
    try {
      const raw = localStorage.getItem(key(proj));
      return raw ? (JSON.parse(raw) as WikivoyageSummary) : null;
    } catch {
      return null;
    }
  };
  const [summary, setSummary] = useState<WikivoyageSummary | null>(() => readSaved("wikivoyage"));
  const [wpSummary, setWpSummary] = useState<WikivoyageSummary | null>(() => readSaved("wikipedia"));
  const [state, setState] = useState<"idle" | "loading" | "empty">("idle");

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useModalKeys(dialogRef, onClose);

  async function loadOverview() {
    setState("loading");
    const [wv, wp] = await Promise.all([
      fetchSummary(summaryTitle),
      fetchSummary(summaryTitle, { project: "wikipedia" }),
    ]);
    setSummary(wv);
    setWpSummary(wp);
    for (const [proj, val] of [["wikivoyage", wv], ["wikipedia", wp]] as const) {
      if (val) {
        try {
          localStorage.setItem(key(proj), JSON.stringify(val));
        } catch {
          /* private mode / full: shown but not saved */
        }
      }
    }
    setState(wv || wp ? "idle" : "empty");
  }

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: links.filter((l) => KIND_GROUP[l.kind] === g),
  })).filter((g) => g.items.length);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal guide-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Travel guides for ${placeName}`}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{placeName} — guides</h2>
        <p className="muted small guide-source">
          From Wikivoyage — the free travel guide. Links open in your browser.
        </p>

        <div className="guide-overviews">
        {state !== "empty" && !summary && !wpSummary && (
          <button
            type="button"
            className="btn-ghost guide-overview-btn"
            disabled={state === "loading"}
            onClick={loadOverview}
          >
            {state === "loading" ? "Loading…" : "↧ Load & save overviews (online)"}
          </button>
        )}
        {state === "empty" && !summary && !wpSummary && (
          <p className="muted small">
            {typeof navigator !== "undefined" && !navigator.onLine
              ? "You're offline — the links below open when you're back online."
              : "No quick overview for this exact title. Try the links or the search below."}{" "}
            <button type="button" className="mini-btn" onClick={loadOverview}>
              Retry
            </button>
          </p>
        )}
        {summary && (
          <blockquote className="guide-summary">
            <p>{summary.extract}</p>
            <cite className="muted small">
              <a href={summary.url} target="_blank" rel="noopener noreferrer">
                Wikivoyage
              </a>{" "}
              ·{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY-SA 4.0
              </a>
            </cite>
          </blockquote>
        )}
        {wpSummary && (
          <blockquote className="guide-summary">
            <p>{wpSummary.extract}</p>
            <cite className="muted small">
              <a href={wpSummary.url} target="_blank" rel="noopener noreferrer">
                Wikipedia
              </a>{" "}
              · CC BY-SA 4.0 · saved for offline
            </cite>
          </blockquote>
        )}
        </div>

        <div className="guide-groups-col">
        {grouped.map(({ group, items }) => (
          <div key={group} className="guide-group">
            <h3>{group}</h3>
            <ul className="guide-links">
              {items.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    <span className="guide-link-label">{l.label}</span>
                    <span className="guide-link-hint muted small">{l.hint}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        </div>

        {/* Honest fallback: a search link always works, even when an exact article
            title doesn't match (name variants) or the overview fetch fails. */}
        <p className="muted small guide-search">
          <a href={searchUrl(searchQuery)} target="_blank" rel="noopener noreferrer">
            Search Wikivoyage for “{searchQuery}”
          </a>
        </p>

        <button ref={closeRef} className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
