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
    <section aria-label="Statistics">
      <div className="section-head">
        <h2>Statistics</h2>
      </div>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="num">{formatInt(coverage.countriesVisited)}</div>
          <div className="label">countries</div>
        </div>
        <div className="stat-tile">
          <div className="num">{formatPercent(coverage.worldPct)}</div>
          <div className="label">of the world</div>
        </div>
        <div className="stat-tile">
          <div className="num">{formatInt(coverage.citiesVisited)}</div>
          <div className="label">cities</div>
        </div>
      </div>

      <div className="section-head">
        <h3>By country</h3>
      </div>

      {countries.length === 0 && <p className="muted empty">No countries yet — add a place.</p>}

      {countries.map((c) => (
        <div key={c.iso2} className="country-card">
          <div className="country-head">
            <strong>{c.name}</strong>
            <span className="muted">
              {formatInt(c.citiesVisited)} cities · {formatInt(c.regionsVisited)} regions
            </span>
          </div>

          <div className="metric">
            <div className="metric-label">
              <span>Cities</span>
              <span className="muted">
                {formatPercent(c.cityPct)}
                {c.citiesTotal > 0 ? ` (${c.citiesVisited}/${c.citiesTotal})` : " — n/a"}
              </span>
            </div>
            <Bar value={c.cityPct} />
          </div>

          <div className="metric">
            <div className="metric-label">
              <span>Regions</span>
              <span className="muted">
                {c.regionsTotal > 0
                  ? `${formatPercent(c.regionPct)} (${c.regionsVisited}/${c.regionsTotal})`
                  : "dataset not loaded"}
              </span>
            </div>
            <Bar value={c.regionPct} />
          </div>
        </div>
      ))}

      <p className="muted small">
        Percentages are computed against the loaded reference datasets. The starter datasets are
        small (full country list; France regions; a sample city gazetteer), so per-country
        denominators reflect what is loaded.
      </p>
    </section>
  );
}
