import { useEffect, useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useSettings } from "../../lib/store/useSettings";
import { useUi } from "../../lib/store/useUi";
import {
  guidesFor,
  fetchSummary,
  fetchFullText,
  searchUrl,
  type WikivoyageSummary,
  type WikiFullText,
} from "../../lib/wikivoyage";
import type { PlaceRef } from "../../lib/schema/models";

const KIND_GROUP: Record<string, string> = {
  place: "Explore",
  country: "Explore",
  understand: "Understand the country",
  phrasebook: "Language & alphabet",
};
const GROUP_ORDER = ["Explore", "Understand the country", "Language & alphabet"];

/** Resolve the names a place's guides are built from (common country name —
 *  the real Wikivoyage article title, e.g. "Russia", not "Russian Federation"). */
function guideNames(place: PlaceRef) {
  const ref = getReferenceData();
  const country = ref.countryByIso2(place.countryId);
  if (!country) return null;
  const countryName = ref.articleNameOf(country.iso2);
  const cityName =
    place.kind === "city" ? ref.cityById(place.id)?.name ?? place.name : undefined;
  // Monuments get THEIR article as the overview (photo of the site, not the
  // country's — whose Wikipedia lead image is usually its flag). Link-building
  // still uses cityName only: Wikivoyage has city guides, rarely monument ones.
  const monumentName =
    place.kind === "heritage" ? ref.heritageById(place.id)?.name ?? place.name : undefined;
  const focusName = cityName ?? monumentName;
  return {
    countryIso2: country.iso2,
    countryName,
    cityName,
    summaryTitle: focusName ?? countryName,
    searchQuery: focusName ? `${focusName} ${countryName}` : countryName,
  };
}

/**
 * A "📖 Guide" affordance for a place, shown in list rows. Rather than a cramped
 * modal (bad on phones), it opens the place's own detail page, which carries the
 * full guides inline (see GuideSection) alongside its photos and journal links.
 */
export function GuideButton({ place, className }: { place: PlaceRef; className?: string }) {
  const names = useMemo(() => guideNames(place), [place]);
  if (!names) return null;

  const open = () => {
    const ui = useUi.getState();
    // City/heritage/custom places have a city page; everything else (country,
    // airport) opens the country page — both render the guides inline.
    if (place.kind === "city" || place.kind === "heritage" || place.kind === "custom") {
      ui.openCity(place.id);
    } else {
      ui.openCountry(place.countryId);
    }
  };

  return (
    <button
      type="button"
      className={className ?? "mini-btn"}
      onClick={open}
      aria-label={`Open ${place.name} with travel guides`}
      title={`Open ${place.name} with travel guides`}
    >
      📖 <span className="row-btn-label">Guide</span>
    </button>
  );
}

/** The same guides as the modal, rendered as an in-page section (city and
 *  country pages get their guides right on the page, not behind a button). */
export function GuideSection({ place }: { place: PlaceRef }) {
  const names = useMemo(() => guideNames(place), [place]);
  if (!names) return null;
  return (
    <section className="city-section guide-section">
      <h3>Guides</h3>
      <GuideContent placeName={place.name} names={names} />
    </section>
  );
}

interface GuideNames {
  countryIso2: string;
  countryName: string;
  cityName: string | undefined;
  summaryTitle: string;
  searchQuery: string;
}

/** Shared body: a single tidy overview card (photo + short extract, loaded when
 *  online) plus the grouped guide links. */
function GuideContent({ placeName, names }: { placeName: string; names: GuideNames }) {
  const ref = useMemo(() => getReferenceData(), []);
  const autoLoad = useSettings((s) => s.autoLoadGuides);
  const { countryIso2, countryName, cityName, summaryTitle, searchQuery } = names;
  // Built lazily here — rows with a closed modal do no guide work at all.
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
  // Overviews are SAVED on-device once loaded, so they reopen offline. The key
  // carries the country too — "Paris, TX" must never show the saved overview of
  // Paris, France as its own (same title, different place).
  const key = (proj: string) => `postcards-guide:${proj}:${countryIso2}:${summaryTitle}`;
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

  // The WHOLE guide, readable in the app (the summary is just the lead and was
  // often visibly cut off, pushing people to the website). Saved on-device too.
  const fullKey = (proj: string) => `postcards-guidefull:${proj}:${countryIso2}:${summaryTitle}`;
  const readSavedFull = (): WikiFullText | null => {
    for (const proj of ["wikivoyage", "wikipedia"] as const) {
      try {
        const raw = localStorage.getItem(fullKey(proj));
        if (raw) return JSON.parse(raw) as WikiFullText;
      } catch {
        /* unreadable / private mode */
      }
    }
    return null;
  };
  const [full, setFull] = useState<WikiFullText | null>(() => readSavedFull());
  const [fullState, setFullState] = useState<"idle" | "loading" | "empty">("idle");

  async function loadFullGuide() {
    setFullState("loading");
    const wv = await fetchFullText(summaryTitle);
    const got = wv ?? (await fetchFullText(summaryTitle, { project: "wikipedia" }));
    setFull(got);
    if (got) {
      try {
        localStorage.setItem(fullKey(wv ? "wikivoyage" : "wikipedia"), JSON.stringify(got));
      } catch {
        /* private mode / full: shown but not saved */
      }
    }
    setFullState(got ? "idle" : "empty");
  }

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

  // Auto-load once, when allowed and online, if nothing is saved yet. Opening a
  // place is the explicit action; the Settings toggle can require a manual tap.
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || summary || wpSummary || !autoLoad) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    tried.current = true;
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: links.filter((l) => KIND_GROUP[l.kind] === g),
  })).filter((g) => g.items.length);

  // Prefer the Wikivoyage travel blurb, fall back to Wikipedia; the photo comes
  // from Wikipedia. One clean card, not two stacked walls of text.
  const overview = summary ?? wpSummary;
  const overviewSource = summary ? "Wikivoyage" : "Wikipedia";
  const photo = wpSummary?.thumb;

  // Once the full guide is loaded, its complete lead replaces the summary
  // extract (the REST summary truncates it); the citation follows the source.
  const fullLead = full?.sections.find((s) => !s.heading)?.text;
  const cardText =
    fullLead && fullLead.length > (overview?.extract.length ?? 0) ? fullLead : overview?.extract;
  const cardUrl = cardText === fullLead && full ? full.url : overview?.url;
  const cardSource =
    cardText === fullLead && full
      ? full.attribution.startsWith("Wikipedia")
        ? "Wikipedia"
        : "Wikivoyage"
      : overviewSource;
  const fullSections = full?.sections.filter((s) => s.heading) ?? [];

  return (
    <div className="guide-body">
      <p className="muted small guide-source">
        Overviews from Wikivoyage and Wikipedia. Links open in your browser.
      </p>

      <div className="guide-overviews">
        {!overview && state === "loading" && (
          <p className="muted small guide-loading">Loading overview…</p>
        )}
        {!overview && state === "idle" && !autoLoad && (
          <button type="button" className="btn-ghost guide-overview-btn" onClick={loadOverview}>
            ↧ Load overview &amp; photo
          </button>
        )}
        {!overview && state === "empty" && (
          <p className="muted small">
            {typeof navigator !== "undefined" && !navigator.onLine
              ? "You're offline; the links below open when you're back online."
              : "No quick overview for this exact title. Try the links or the search below."}{" "}
            <button type="button" className="mini-btn" onClick={loadOverview}>
              Retry
            </button>
          </p>
        )}
        {(overview || full) && cardText && (
          <figure className="guide-card">
            {photo && (
              <img
                className="guide-photo"
                src={photo}
                alt={`Photo of ${placeName}`}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            <blockquote className="guide-extract">
              {cardText.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </blockquote>
            <figcaption className="muted small guide-cite">
              <a href={cardUrl} target="_blank" rel="noopener noreferrer">
                Read more on {cardSource}
              </a>{" "}
              · CC BY-SA · saved offline
            </figcaption>
          </figure>
        )}

        {/* The whole guide, readable right here — no trip to the website. */}
        {(overview || full) && !full && fullState === "idle" && (
          <button type="button" className="btn-ghost guide-overview-btn" onClick={() => void loadFullGuide()}>
            📖 Read the whole guide here
          </button>
        )}
        {fullState === "loading" && (
          <p className="muted small guide-loading">Loading the full guide…</p>
        )}
        {fullState === "empty" && (
          <p className="muted small">
            {typeof navigator !== "undefined" && !navigator.onLine
              ? "You're offline — the full guide loads when you're back online."
              : "No full guide for this exact title — the links below still work."}{" "}
            <button type="button" className="mini-btn" onClick={() => void loadFullGuide()}>
              Retry
            </button>
          </p>
        )}
        {fullSections.length > 0 && (
          <div className="guide-full">
            {fullSections.map((s) => (
              <details key={s.heading} className="guide-full-section">
                <summary>{s.heading}</summary>
                {s.text.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </details>
            ))}
            {full && (
              <p className="muted small guide-cite">
                Full guide ·{" "}
                <a href={full.url} target="_blank" rel="noopener noreferrer">
                  {full.attribution}
                </a>{" "}
                · saved offline
              </p>
            )}
          </div>
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
    </div>
  );
}
