import { useMemo } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { getReferenceData } from "../../lib/reference/referenceData";
import { computeCoverage, visitedCountriesList } from "./computeStats";
import { formatInt, formatPercent } from "../../lib/format/format";

function Bar({ value }: { value: number }) {
  return (
    <div
      className="bar"
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

export function StatsView() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);

  const coverage = useMemo(() => computeCoverage(visits, ref), [visits, ref]);
  const countries = useMemo(() => visitedCountriesList(visits, ref), [visits, ref]);

  return (
    <div className="panel">
      <h2>Statistics</h2>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="num">{formatInt(coverage.countriesVisited)}</div>
          <div className="label">countries visited</div>
        </div>
        <div className="stat-tile">
          <div className="num">{formatPercent(coverage.worldPct)}</div>
          <div className="label">of the world ({formatInt(coverage.worldCountryCount)})</div>
        </div>
        <div className="stat-tile">
          <div className="num">{formatInt(coverage.citiesVisited)}</div>
          <div className="label">cities visited</div>
        </div>
      </div>

      <h3 style={{ fontSize: 15 }}>By country</h3>
      {countries.length === 0 && <p className="muted">No countries yet — add a visit.</p>}
      {countries.map((c) => (
        <div key={c.iso2} className="country-row" style={{ display: "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <strong>{c.name}</strong>
            <span className="muted">
              {formatInt(c.citiesVisited)} cities · {formatInt(c.regionsVisited)} regions
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Cities: {formatPercent(c.cityPct)}{" "}
              {c.citiesTotal > 0 ? `(${c.citiesVisited}/${c.citiesTotal})` : "(dataset not loaded)"}
            </div>
            <Bar value={c.cityPct} />
          </div>
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Regions: {formatPercent(c.regionPct)}{" "}
              {c.regionsTotal > 0
                ? `(${c.regionsVisited}/${c.regionsTotal})`
                : "(dataset not loaded)"}
            </div>
            <Bar value={c.regionPct} />
          </div>
        </div>
      ))}

      <p className="attribution">
        Percentages are computed against the loaded reference datasets. The starter datasets are
        small (full country list; France regions; a sample city gazetteer), so per-country
        denominators reflect what is loaded — see the follow-up task to vendor the full datasets.
      </p>
    </div>
  );
}
