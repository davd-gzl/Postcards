import { useMemo, useState } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { useSettings } from "../../lib/store/useSettings";
import { getReferenceData } from "../../lib/reference/referenceData";
import {
  computeCoverage,
  computeContinentCoverage,
  countryDetail,
  visitedCountriesList,
  type CountrySort,
} from "./computeStats";
import { travelTotals } from "../travel/distance";
import { countryFlag, formatInt, formatKm, formatPercent } from "../../lib/format/format";
import { CONTINENT_COLORS } from "../../lib/reference/continents";
import { CountryScopeSelect } from "../../ui/CountryScopeSelect";

const MODE_GLYPH: Record<string, string> = {
  flight: "✈️",
  train: "🚆",
  bus: "🚌",
  ferry: "⛴️",
  car: "🚗",
  other: "•",
};

/** Join names, capping a long list so a huge country doesn't flood the card. */
function capList(names: string[], max = 18): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

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
  const trips = useTrips((s) => s.trips);

  const scope = useSettings((s) => s.countryScope);
  const [sortBy, setSortBy] = useState<CountrySort>("cities");
  const coverage = useMemo(() => computeCoverage(visits, ref, scope), [visits, ref, scope]);
  const travel = useMemo(() => travelTotals(trips, ref), [trips, ref]);
  const continentCov = useMemo(
    () => computeContinentCoverage(visits, ref, scope),
    [visits, ref, scope],
  );
  const countries = useMemo(
    () => visitedCountriesList(visits, ref, sortBy, scope),
    [visits, ref, sortBy, scope],
  );

  return (
    <section aria-label="Statistics">
      <div className="section-head">
        <h2>Statistics</h2>
        <CountryScopeSelect />
      </div>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="num">{formatInt(coverage.countriesVisited)}</div>
          <div className="label">countries</div>
        </div>
        <div className="stat-tile">
          <div className="num">{formatPercent(coverage.worldPct)}</div>
          <div className="label">
            of {formatInt(coverage.worldCountryCount)}{" "}
            {scope === "un" ? "UN member states" : "countries & territories"}
          </div>
        </div>
        <div className="stat-tile">
          <div className="num">{formatInt(coverage.citiesVisited)}</div>
          <div className="label">cities</div>
        </div>
        {coverage.airportsVisited > 0 && (
          <div className="stat-tile">
            <div className="num">{formatInt(coverage.airportsVisited)}</div>
            <div className="label">airports</div>
          </div>
        )}
        {coverage.monumentsVisited > 0 && (
          <div className="stat-tile">
            <div className="num">{formatInt(coverage.monumentsVisited)}</div>
            <div className="label">monuments</div>
          </div>
        )}
      </div>

      {travel.trips > 0 && (
        <>
          <div className="section-head">
            <h3>Travel</h3>
          </div>
          <div className="travel-totals" aria-label="Travel totals">
            <span className="tt-main">
              <strong>{formatInt(travel.trips)}</strong> {travel.trips === 1 ? "trip" : "trips"}
            </span>
            <span className="tt-sep" aria-hidden />
            <span className="tt-main">
              <strong>{formatKm(travel.totalKm)}</strong> travelled
            </span>
            {travel.byMode.length > 0 && (
              <span className="tt-modes">
                {travel.byMode.map((m) => (
                  <span className="tt-mode" key={m.mode} title={`${m.trips} by ${m.mode}`}>
                    {MODE_GLYPH[m.mode]} {m.trips}
                  </span>
                ))}
              </span>
            )}
          </div>
        </>
      )}

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
              <strong>
                <span className="flag" aria-hidden>
                  {countryFlag(c.iso2)}
                </span>{" "}
                {c.name}
              </strong>
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

            {c.heritageTotal > 0 && (
              <div className="metric">
                <div className="metric-label">
                  <span>Heritage sites</span>
                  <span className="muted">
                    {formatPercent(c.heritagePct)} · {c.heritageVisited}/{c.heritageTotal} UNESCO
                  </span>
                </div>
                <Bar value={c.heritagePct} label={`${c.name}: heritage sites visited`} color="#b45309" />
              </div>
            )}

            {(detail.cities.length > 0 ||
              detail.regionsVisited.length > 0 ||
              detail.regionsRemainingNames.length > 0 ||
              detail.monumentsVisited.length > 0) && (
              <details className="country-detail">
                <summary>What you've seen · what's left</summary>
                {detail.cities.length > 0 && (
                  <p className="muted small">
                    <strong>Cities:</strong> {detail.cities.join(", ")}
                  </p>
                )}
                {detail.regionsVisited.length > 0 && (
                  <p className="muted small">
                    <strong>Regions visited:</strong> {detail.regionsVisited.join(", ")}
                  </p>
                )}
                {detail.regionsRemainingNames.length > 0 && (
                  <p className="muted small">
                    <strong>Regions to visit:</strong> {capList(detail.regionsRemainingNames)}
                  </p>
                )}
                {detail.monumentsVisited.length > 0 && (
                  <p className="muted small">
                    <strong>Monuments seen:</strong> {detail.monumentsVisited.join(", ")}
                  </p>
                )}
                {detail.monumentsRemaining.length > 0 && (
                  <p className="muted small">
                    <strong>Monuments to see:</strong> {capList(detail.monumentsRemaining)}
                  </p>
                )}
              </details>
            )}
          </div>
        );
      })}

      <p className="muted small">
        Computed against the loaded reference datasets: all countries &amp; territories (ISO
        3166-1), a GeoNames gazetteer of cities with 15,000+ people, and first-level regions
        (states/provinces) worldwide.
      </p>
    </section>
  );
}
