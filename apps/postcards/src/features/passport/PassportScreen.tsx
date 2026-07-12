import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { useSettings } from "../../lib/store/useSettings";
import { useToast } from "../../lib/store/useToast";
import { computeCoverage, visitedCountryIds } from "../stats/computeStats";
import { inScope } from "../../lib/reference/scope";
import { countryFlag, formatInt } from "../../lib/format/format";
import { ScopeToggle } from "../../ui/ScopeToggle";
import { renderPoster } from "./poster";

/**
 * Your passport: the flags you've collected (one per visited country — a city
 * visit collects its country's flag), and a downloadable PNG poster of your
 * world. All rendered on-device. `embedded` renders it as a view inside the
 * Places screen (smaller heading under the Places one).
 */
export function PassportScreen({ embedded }: { embedded?: boolean } = {}) {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const scope = useSettings((s) => s.countryScope);
  const showToast = useToast((s) => s.show);
  const [showMissing, setShowMissing] = useState(false);
  const [rendering, setRendering] = useState(false);
  // The rendered poster is SHOWN first (a preview overlay); downloading is a
  // button inside it — not a silent file drop.
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  function closePoster() {
    setPosterUrl(null);
  }
  // The object URL is revoked here — on close, on replace AND on unmount
  // (closing by switching tabs must not leak the rendered PNG).
  useEffect(() => {
    if (!posterUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosterUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      URL.revokeObjectURL(posterUrl);
    };
  }, [posterUrl]);

  const visitedIds = useMemo(() => visitedCountryIds(visits), [visits]);
  const { collected, missing, continents } = useMemo(() => {
    const all = ref.countries.filter((c) => inScope(c.sovereignty, scope));
    const collected = all.filter((c) => visitedIds.has(c.iso2));
    const missing = all.filter((c) => !visitedIds.has(c.iso2));
    // Collected flags grouped by continent, each with its own progress, so the
    // passport reads like pages of a real one.
    const byCont = new Map<string, { done: typeof all; total: number }>();
    for (const c of all) {
      const key = c.continent || "Elsewhere";
      if (!byCont.has(key)) byCont.set(key, { done: [], total: 0 });
      const g = byCont.get(key)!;
      g.total += 1;
      if (visitedIds.has(c.iso2)) g.done.push(c);
    }
    const continents = [...byCont.entries()]
      .filter(([, g]) => g.done.length > 0)
      .map(([name, g]) => ({ name, done: g.done, total: g.total }))
      .sort((a, b) => b.done.length - a.done.length || a.name.localeCompare(b.name));
    return { collected, missing, continents };
  }, [ref, visitedIds, scope]);
  const [shownMissing, setShownMissing] = useState(60);

  // Where to stamp a visited country whose geometry the basemap lacks (Kosovo,
  // Tuvalu, overseas territories…): the coordinates of a place you visited there.
  // Nothing is invented — the anchor comes from the gazetteer/your own record.
  const fallbackAnchors = useMemo(() => {
    const anchors = new Map<string, [number, number]>();
    for (const v of visits) {
      if (v.status === "wishlist" || anchors.has(v.place.countryId)) continue;
      let lon: number | undefined;
      let lat: number | undefined;
      if (v.place.kind === "city") {
        const c = ref.cityById(v.place.id);
        if (c) [lon, lat] = [c.lon, c.lat];
      } else if (v.place.kind === "heritage") {
        const h = ref.heritageById(v.place.id);
        if (h && (h.lat !== 0 || h.lon !== 0)) [lon, lat] = [h.lon, h.lat];
      } else if (v.place.kind === "airport") {
        const a = ref.airportById(v.place.id);
        if (a) [lon, lat] = [a.lon, a.lat];
      } else if (v.place.kind === "custom" && v.place.lat != null && v.place.lon != null) {
        [lon, lat] = [v.place.lon, v.place.lat];
      }
      if (lon != null && lat != null) anchors.set(v.place.countryId, [lon, lat]);
    }
    return anchors;
  }, [visits, ref]);

  async function exportPoster() {
    setRendering(true);
    try {
      const cov = computeCoverage(visits, ref, scope);
      // Stamp only in-scope countries, so the flags match the caption count
      // and the flag grid (both already scope-filtered).
      const stampIds = new Set(
        [...visitedIds].filter((iso2) => {
          const c = ref.countryByIso2(iso2);
          return !!c && inScope(c.sovereignty, scope);
        }),
      );
      const blob = await renderPoster(stampIds, ref, {
        countries: cov.countriesVisited,
        cities: cov.citiesVisited,
      }, { anchors: fallbackAnchors });
      setPosterUrl(URL.createObjectURL(blob));
    } catch {
      showToast("Couldn't render the poster (map geometry unavailable offline?).");
    } finally {
      setRendering(false);
    }
  }

  return (
    <section aria-label="Passport">
      <div className="section-head">
        {embedded ? <h3>Passport</h3> : <h2>Passport</h2>}
        <ScopeToggle />
      </div>

      <div className="passport-head">
        <p className="muted">
          <strong className="flags-count">{formatInt(collected.length)}</strong> of{" "}
          {formatInt(collected.length + missing.length)} flags collected
        </p>
        <button className="btn" type="button" disabled={rendering} onClick={() => void exportPoster()}>
          {rendering ? "Rendering…" : "🖼 World poster"}
        </button>
      </div>

      {collected.length === 0 ? (
        <p className="muted empty">
          <span className="empty-emoji" aria-hidden>
            🛂
          </span>
          No stamps yet — visit a city and its country's flag lands here.
        </p>
      ) : (
        continents.map((cont) => (
          <section key={cont.name} className="passport-continent">
            <h3>
              {cont.name} <span className="muted small">{cont.done.length} of {cont.total}</span>
            </h3>
            <ul className="flag-grid">
              {cont.done.map((c) => (
                <li key={c.iso2}>
                  <button
                    type="button"
                    className="flag-card"
                    title={`Open ${c.name}`}
                    onClick={() => useUi.getState().openCountry(c.iso2)}
                  >
                    <span className="flag-big" aria-hidden>
                      {countryFlag(c.iso2)}
                    </span>
                    <span className="flag-name">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <button
        className="link"
        type="button"
        aria-expanded={showMissing}
        onClick={() => setShowMissing((s) => !s)}
      >
        {showMissing ? "Hide" : "Show"} the {formatInt(missing.length)} still to collect
      </button>
      {posterUrl && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Your world poster" onClick={closePoster}>
          <img className="lightbox-img" src={posterUrl} alt="World map poster with a flag on every visited country" />
          <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
            <a className="mini-btn" href={posterUrl} download="postcards-world.png">
              ⬇ Download PNG
            </a>
            <button className="btn-ghost" type="button" autoFocus onClick={closePoster}>
              Close
            </button>
          </div>
        </div>
      )}

      {showMissing && (
        <>
        <ul className="flag-grid">
          {missing.slice(0, shownMissing).map((c) => (
            <li key={c.iso2}>
              <button
                type="button"
                className="flag-card flag-locked"
                title={`Open ${c.name}`}
                onClick={() => useUi.getState().openCountry(c.iso2)}
              >
                <span className="flag-big" aria-hidden>
                  {countryFlag(c.iso2)}
                </span>
                <span className="flag-name">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {missing.length > shownMissing && (
          <div className="list-pager">
            <span className="muted small">
              Showing {shownMissing} of {missing.length}
            </span>
            <button className="mini-btn" type="button" onClick={() => setShownMissing((n) => n + 60)}>
              Show 60 more
            </button>
          </div>
        )}
        </>
      )}
    </section>
  );
}
