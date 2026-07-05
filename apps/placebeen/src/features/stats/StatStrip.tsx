import { useMemo } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { getReferenceData } from "../../lib/reference/referenceData";
import { computeCoverage } from "./computeStats";
import { formatInt } from "../../lib/format/format";

/** Compact counter strip (à la Places Been): countries, cities been/want/fav. */
export function StatStrip() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);

  const stats = useMemo(() => {
    const cov = computeCoverage(visits, ref);
    let want = 0;
    let fav = 0;
    for (const v of visits) {
      if (v.status === "wishlist") want++;
      if (v.favorite) fav++;
    }
    return { cov, want, fav };
  }, [visits, ref]);

  return (
    <div className="stat-strip" aria-label="Your totals">
      <span className="ss-item">
        <span className="ss-num">
          {formatInt(stats.cov.countriesVisited)}
          <span className="ss-den">/{formatInt(stats.cov.worldCountryCount)}</span>
        </span>
        <span className="ss-label">countries</span>
      </span>
      <span className="ss-sep" aria-hidden />
      <span className="ss-item">
        <span className="ss-num ss-been">{formatInt(stats.cov.citiesVisited)}</span>
        <span className="ss-label">been</span>
      </span>
      <span className="ss-item">
        <span className="ss-num ss-want">{formatInt(stats.want)}</span>
        <span className="ss-label">want</span>
      </span>
      <span className="ss-item">
        <span className="ss-num ss-fav">{formatInt(stats.fav)}</span>
        <span className="ss-label">fav</span>
      </span>
    </div>
  );
}
