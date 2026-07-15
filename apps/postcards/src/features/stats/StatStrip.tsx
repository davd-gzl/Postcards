import { useMemo } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { useSettings } from "../../lib/store/useSettings";
import { useUi, type PlacesView } from "../../lib/store/useUi";
import { getReferenceData } from "../../lib/reference/referenceData";
import { computeCoverage } from "./computeStats";
import { formatInt, formatPercent } from "../../lib/format/format";

/** Compact counter strip. Every counter is a shortcut: tap it to open the
 *  matching Places view (been → visited, want → wishlist, fav → favourites…). */
export function StatStrip() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const scope = useSettings((s) => s.countryScope);
  const openPlaces = useUi((s) => s.openPlaces);

  const stats = useMemo(() => {
    const cov = computeCoverage(visits, ref, scope);
    let want = 0;
    let fav = 0;
    for (const v of visits) {
      if (v.status === "wishlist") want++;
      if (v.favorite) fav++;
    }
    return { cov, want, fav };
  }, [visits, ref, scope]);

  function Counter({
    num,
    den,
    pct,
    label,
    cls,
    view,
  }: {
    num: number;
    den?: number;
    /** Optional share (0..1) shown next to the fraction — e.g. "3/50 · 6%". */
    pct?: number;
    label: string;
    cls?: string;
    view: PlacesView;
  }) {
    const aria =
      pct != null
        ? `${formatInt(num)} of ${formatInt(den ?? num)} ${label} visited (${formatPercent(pct)}) — open your ${label}`
        : `Open your ${label}`;
    return (
      <button
        type="button"
        className="ss-item"
        onClick={() => openPlaces(view)}
        title={`Open your ${label}`}
        aria-label={aria}
      >
        <span className={"ss-num" + (cls ? ` ${cls}` : "")}>
          {formatInt(num)}
          {den != null && <span className="ss-den">/{formatInt(den)}</span>}
          {pct != null && <span className="ss-pct">{formatPercent(pct)}</span>}
        </span>
        <span className="ss-label">{label}</span>
      </button>
    );
  }

  return (
    <div className="stat-strip" aria-label="Your totals">
      <Counter
        num={stats.cov.countriesVisited}
        den={stats.cov.worldCountryCount}
        pct={stats.cov.worldPct}
        label="countries"
        view="countries"
      />
      <span className="ss-sep" aria-hidden />
      <Counter num={stats.cov.citiesVisited} label="been" cls="ss-been" view="visited" />
      {stats.cov.airportsVisited > 0 && (
        <Counter num={stats.cov.airportsVisited} label="airports" cls="ss-air" view="visited" />
      )}
      <Counter num={stats.want} label="want" cls="ss-want" view="wishlist" />
      <Counter num={stats.fav} label="fav" cls="ss-fav" view="favorites" />
    </div>
  );
}
