import { useMemo, useState } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { useSettings } from "../../lib/store/useSettings";
import { getReferenceData } from "../../lib/reference/referenceData";
import {
  computeCoverage,
  computeContinentCoverage,
  computeRecords,
  countryDetail,
  visitedCountriesList,
  type CountrySort,
} from "./computeStats";
import { travelTotals } from "../travel/distance";
import { useUi } from "../../lib/store/useUi";
import { countryFlag, formatInt, formatKm, formatPercent } from "../../lib/format/format";
import { CONTINENT_COLORS } from "../../lib/reference/continents";
import { ScopeToggle } from "../../ui/ScopeToggle";

const MODE_GLYPH: Record<string, string> = {
  flight: "✈️",
  train: "🚆",
  bus: "🚌",
  ferry: "⛴️",
  car: "🚗",
  other: "•",
};

/** A row of tappable chips, capped so a huge country doesn't flood the card. */
function ChipRow({
  label,
  names,
  done,
  onPick,
  max = 16,
}: {
  label: string;
  names: string[];
  /** Style as already-seen (filled) vs still-to-do (outlined). */
  done?: boolean;
  onPick?: (name: string) => void;
  max?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (names.length === 0) return null;
  const shown = expanded ? names : names.slice(0, max);
  return (
    <div className="chip-row">
      <span className="chip-row-label">{label}</span>
      <span className="chip-row-chips">
        {shown.map((n) => (
          <button
            key={n}
            type="button"
            className={"place-chip" + (done ? " chip-done" : "")}
            onClick={onPick ? () => onPick(n) : undefined}
            disabled={!onPick}
            title={onPick ? `Show ${n} on the map` : undefined}
          >
            {n}
          </button>
        ))}
        {names.length > max && (
          <button type="button" className="place-chip chip-more" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "less" : `+${names.length - max} more`}
          </button>
        )}
      </span>
    </div>
  );
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
  const flyTo = useUi((s) => s.flyTo);

  const scope = useSettings((s) => s.countryScope);
  const [sortBy, setSortBy] = useState<CountrySort>("cities");
  const coverage = useMemo(() => computeCoverage(visits, ref, scope), [visits, ref, scope]);
  const records = useMemo(() => computeRecords(visits, ref), [visits, ref]);
  const travel = useMemo(() => travelTotals(trips, ref), [trips, ref]);

  function flyToCity(iso2: string) {
    return (name: string) => {
      const c = ref.citiesOf(iso2).find((x) => x.name === name);
      if (c) flyTo(c.lon, c.lat);
    };
  }
  function flyToMonument(iso2: string) {
    return (name: string) => {
      const h = ref.heritageOf(iso2).find((x) => x.name === name);
      if (h && (h.lat !== 0 || h.lon !== 0)) flyTo(h.lon, h.lat);
    };
  }
  function flyToRegion(iso2: string) {
    return (name: string) => {
      const sub = ref.subdivisionsOf(iso2).find((s) => s.name === name);
      if (!sub) return;
      const cities = ref.citiesOf(iso2).filter((c) => c.subdivisionId === sub.id);
      if (!cities.length) return;
      const lat = cities.reduce((s, c) => s + c.lat, 0) / cities.length;
      const lon = cities.reduce((s, c) => s + c.lon, 0) / cities.length;
      flyTo(lon, lat);
    };
  }
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
        <ScopeToggle />
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

      {(records.northernmost || records.biggestCity || records.firstVisit) && (
        <>
          <div className="section-head">
            <h3>Records</h3>
          </div>
          <div className="records-grid">
            {records.northernmost && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🧭</span>
                <span>
                  Northernmost: <strong>{records.northernmost.name}</strong>{" "}
                  <span className="muted">({records.northernmost.lat.toFixed(1)}°)</span>
                </span>
              </div>
            )}
            {records.southernmost && records.southernmost.name !== records.northernmost?.name && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🐧</span>
                <span>
                  Southernmost: <strong>{records.southernmost.name}</strong>{" "}
                  <span className="muted">({records.southernmost.lat.toFixed(1)}°)</span>
                </span>
              </div>
            )}
            {records.biggestCity && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🏙️</span>
                <span>
                  Biggest city: <strong>{records.biggestCity.name}</strong>{" "}
                  <span className="muted">({formatInt(records.biggestCity.population)} people)</span>
                </span>
              </div>
            )}
            {records.firstVisit && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🌱</span>
                <span>
                  First dated visit: <strong>{records.firstVisit.name}</strong>{" "}
                  <span className="muted">({records.firstVisit.date})</span>
                </span>
              </div>
            )}
            {records.latestVisit && records.latestVisit.date !== records.firstVisit?.date && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🆕</span>
                <span>
                  Latest: <strong>{records.latestVisit.name}</strong>{" "}
                  <span className="muted">({records.latestVisit.date})</span>
                </span>
              </div>
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
                <ChipRow label="Cities" names={detail.cities} done onPick={flyToCity(c.iso2)} />
                <ChipRow
                  label="Regions visited"
                  names={detail.regionsVisited}
                  done
                  onPick={flyToRegion(c.iso2)}
                />
                <ChipRow
                  label="Regions to visit"
                  names={detail.regionsRemainingNames}
                  onPick={flyToRegion(c.iso2)}
                />
                <ChipRow
                  label="Monuments seen"
                  names={detail.monumentsVisited}
                  done
                  onPick={flyToMonument(c.iso2)}
                />
                <ChipRow
                  label="Monuments to see"
                  names={detail.monumentsRemaining}
                  onPick={flyToMonument(c.iso2)}
                />
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
