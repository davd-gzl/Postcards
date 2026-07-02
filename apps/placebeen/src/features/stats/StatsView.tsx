import { useMemo, useState } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { getReferenceData } from "../../lib/reference/referenceData";
import {
  computeCoverage,
  computeContinentCoverage,
  countryDetail,
  visitedCountriesList,
  type CountrySort,
} from "./computeStats";
import { formatInt, formatPercent } from "../../lib/format/format";
import { CONTINENT_COLORS } from "../../lib/reference/continents";

function Bar({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div
      className="bar"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
    </div>
  );
}

export function StatsView() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);

  const [sortBy, setSortBy] = useState<CountrySort>("cities");
  const coverage = useMemo(() => computeCoverage(visits, ref), [visits, ref]);
  const continentCov = useMemo(() => computeContinentCoverage(visits, ref), [visits, ref]);
  const countries = useMemo(
    () => visitedCountriesList(visits, ref, sortBy),
    [visits, ref, sortBy],
  );

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
          <div className="label">
            of {formatInt(coverage.worldCountryCount)} countries &amp; territories
          </div>
        </div>
        <div className="stat-tile">
          <div className="num">{formatInt(coverage.citiesVisited)}</div>
          <div className="label">cities</div>
        </div>
      </div>

      {continentCov.length > 0 && (
        <>
          <div className="section-head">
            <h3>By continent</h3>
          </div>
          <div className="continent-grid">
            {continentCov.map((c) => (
              <div key={c.continent} className="metric">
                <div className="metric-label">
                  <span>
                    <span
                      className="legend-dot"
                      style={{
                        background: CONTINENT_COLORS[c.continent] ?? "#9aa4b2",
                        display: "inline-block",
                        marginRight: 6,
                      }}
                      aria-hidden
                    />
                    {c.continent}
                  </span>
                  <span className="muted">
                    {c.visited}/{c.total} countries
                  </span>
                </div>
                <Bar
                  value={c.pct}
                  label={`${c.continent}: countries visited`}
                  color={CONTINENT_COLORS[c.continent]}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-head">
        <h3>By country</h3>
        <label className="sort-label">
          <span className="sr-only">Sort countries</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CountrySort)}
          >
            <option value="cities">Most cities</option>
            <option value="regions">Most regions</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {countries.length === 0 && <p className="muted empty">No countries yet — add a place.</p>}

      {countries.map((c) => {
        const detail = countryDetail(visits, ref, c.iso2);
        return (
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
                  {c.citiesTotal > 0
                    ? `${formatPercent(c.cityPct)} · ${c.citiesVisited}/${c.citiesTotal} known cities`
                    : "no city data"}
                </span>
              </div>
              {c.citiesTotal > 0 && <Bar value={c.cityPct} label={`${c.name}: cities visited`} />}
            </div>

            <div className="metric">
              <div className="metric-label">
                <span>Regions</span>
                <span className="muted">
                  {c.regionsTotal > 0
                    ? `${formatPercent(c.regionPct)} · ${c.regionsVisited}/${c.regionsTotal}`
                    : "dataset not loaded"}
                </span>
              </div>
              {c.regionsTotal > 0 && (
                <Bar value={c.regionPct} label={`${c.name}: regions visited`} />
              )}
            </div>

            {(detail.cities.length > 0 || detail.regionsVisited.length > 0) && (
              <details className="country-detail">
                <summary>Details</summary>
                {detail.cities.length > 0 && (
                  <p className="muted small">
                    <strong>Cities:</strong> {detail.cities.join(", ")}
                  </p>
                )}
                {detail.regionsVisited.length > 0 && (
                  <p className="muted small">
                    <strong>Regions:</strong> {detail.regionsVisited.join(", ")}
                    {detail.regionsRemaining > 0 && ` — ${detail.regionsRemaining} to go`}
                  </p>
                )}
              </details>
            )}
          </div>
        );
      })}

      <p className="muted small">
        Computed against the loaded reference datasets: all countries &amp; territories (ISO
        3166-1), a GeoNames gazetteer of cities with 15,000+ people, and first-level regions where
        loaded (France).
      </p>
    </section>
  );
}
