import { useMemo, useState } from "react";
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
 * world. All rendered on-device.
 */
export function PassportScreen() {
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
    if (posterUrl) URL.revokeObjectURL(posterUrl);
    setPosterUrl(null);
  }

  const visitedIds = useMemo(() => visitedCountryIds(visits), [visits]);
  const { collected, missing } = useMemo(() => {
    const all = ref.countries.filter((c) => inScope(c.sovereignty, scope));
    return {
      collected: all.filter((c) => visitedIds.has(c.iso2)),
      missing: all.filter((c) => !visitedIds.has(c.iso2)),
    };
  }, [ref, visitedIds, scope]);

  async function exportPoster() {
    setRendering(true);
    try {
      const cov = computeCoverage(visits, ref, scope);
      const blob = await renderPoster(visitedIds, ref, {
        countries: cov.countriesVisited,
        cities: cov.citiesVisited,
      });
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
        <h2>Passport</h2>
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
        <ul className="flag-grid">
          {collected.map((c) => (
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
            <button className="btn-ghost" type="button" onClick={closePoster}>
              Close
            </button>
          </div>
        </div>
      )}

      {showMissing && (
        <ul className="flag-grid">
          {missing.map((c) => (
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
      )}
    </section>
  );
}
