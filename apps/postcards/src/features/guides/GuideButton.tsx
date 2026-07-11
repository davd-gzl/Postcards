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

  // Country & city names + languages — everything the reusable seam needs. Use the
  // COMMON country name (the real Wikivoyage article title, e.g. "Russia") rather
  // than the ISO-official name ("Russian Federation"), which would 404.
  const country = ref.countryByIso2(place.countryId);
  const countryName = country ? ref.articleNameOf(country.iso2) : place.countryId;
  const cityName =
    place.kind === "city" ? ref.cityById(place.id)?.name ?? place.name : undefined;
  const links = useMemo(() => {
    if (!country) return [];
    return guidesFor({
      cityName,
      countryName,
      countryIso2: country.iso2,
      languages: ref.languagesOf(country.iso2),
    });
  }, [ref, country, countryName, cityName]);

  if (!country || links.length === 0) return null;

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
          links={links}
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
  links,
  onClose,
}: {
  placeName: string;
  summaryTitle: string;
  searchQuery: string;
  links: ReturnType<typeof guidesFor>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<WikivoyageSummary | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "empty">("idle");

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useModalKeys(dialogRef, onClose);

  async function loadOverview() {
    setState("loading");
    const s = await fetchSummary(summaryTitle);
    setSummary(s);
    setState(s ? "idle" : "empty");
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

        {state !== "empty" && !summary && (
          <button
            type="button"
            className="btn-ghost guide-overview-btn"
            disabled={state === "loading"}
            onClick={loadOverview}
          >
            {state === "loading" ? "Loading…" : "↧ Load a short overview (online)"}
          </button>
        )}
        {state === "empty" && !summary && (
          <p className="muted small">
            {typeof navigator !== "undefined" && !navigator.onLine
              ? "You're offline — the links below open when you're back online."
              : "No quick overview for this exact title. Try the links or the search below."}
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
