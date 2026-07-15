import { useMemo, useState } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { useSettings } from "../../lib/store/useSettings";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useGazetteerGeneration } from "../../lib/reference/useGazetteer";
import {
  computeCoverage,
  computeContinentCoverage,
  computeRecords,
  countryDetail,
  visitedCountriesList,
  type CountryCoverage,
  type CountrySort,
} from "./computeStats";
import { travelTotals } from "../travel/distance";
import { MODE_GLYPH } from "../travel/modes";
import { useUi } from "../../lib/store/useUi";
import { countryFlag, formatInt, formatKm, formatPercent } from "../../lib/format/format";
import { CONTINENT_COLORS, CONTINENT_ORDER } from "../../lib/reference/continents";
import { ScopeToggle } from "../../ui/ScopeToggle";

// Coverage-ring geometry: two concentric circles in a 120×120 viewBox. The
// value arc's length is driven by stroke-dashoffset against this circumference.
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** A row of tappable chips, capped so a huge country doesn't flood the card. */
function ChipRow({
  label,
  names,
  done,
  onPick,
  hint = "Open",
  max = 16,
}: {
  label: string;
  names: string[];
  /** Style as already-seen (filled) vs still-to-do (outlined). */
  done?: boolean;
  onPick?: (name: string) => void;
  /** Tooltip verb; chips either open a page or fly the map. */
  hint?: string;
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
            title={onPick ? `${hint} ${n}` : undefined}
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

/** A record's city name — a button that flies the map to it. */
function RecordCity({ name, onPick }: { name: string; onPick: (name: string) => void }) {
  return (
    <button
      type="button"
      className="country-open"
      title={`Show ${name} on the map`}
      onClick={() => onPick(name)}
    >
      {name}
    </button>
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

/**
 * One country as a native <details>: the collapsed <summary> is a scannable
 * roster row (flag + name + tag pills + one slim cities meter); expanding reveals
 * the three metrics and the place chips. The chip name-lists are computed only
 * once the row is opened (lazy, keyed off onToggle), and recompute when the full
 * gazetteer lands (gazGen).
 */
function CountryRow({
  c,
  flyToRegion,
}: {
  c: CountryCoverage;
  flyToRegion: (name: string) => void;
}) {
  const ref = useMemo(() => getReferenceData(), []);
  const gazGen = useGazetteerGeneration(); // city lists grow when the full gazetteer lands
  const visits = useVisits((s) => s.visits);
  const [open, setOpen] = useState(false);
  const detail = useMemo(
    () => (open ? countryDetail(visits, ref, c.iso2) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, visits, ref, c.iso2, gazGen],
  );
  // Tapping a city or monument chip opens its detail page directly (you clicked
  // the place, so show the place), never just a map fly-by.
  const openByName = (list: { id: string; name: string }[]) => (name: string) => {
    const hit = list.find((x) => x.name === name);
    if (hit) useUi.getState().openCity(hit.id);
  };
  return (
    <details className="country-card" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="country-summary">
        {/* Plain label so the whole row toggles the <details> — keeping an
            interactive control out of <summary> (no nested-interactive). The
            "open the country page" action lives as a real button on expand. */}
        <span className="country-name">
          <span className="flag" aria-hidden>
            {countryFlag(c.iso2)}
          </span>{" "}
          {c.name}
        </span>
        <span className="country-tags">
          <span className="country-tag">{formatInt(c.citiesVisited)} cities</span>
          <span className="country-tag">{formatInt(c.regionsVisited)} regions</span>
          {c.heritageTotal > 0 && (
            <span className="country-tag">{formatInt(c.heritageVisited)} sites</span>
          )}
        </span>
        <span className="country-caret" aria-hidden>
          ›
        </span>
        <Bar value={c.cityPct} label={`${c.name}: cities visited`} />
      </summary>

      <div className="country-body">
        <button
          type="button"
          className="country-open country-open-page"
          title={`Open ${c.name}`}
          onClick={() => useUi.getState().openCountry(c.iso2)}
        >
          <span className="flag" aria-hidden>
            {countryFlag(c.iso2)}
          </span>{" "}
          Open {c.name}{" "}
          <span aria-hidden>↗</span>
        </button>

        <div className="metric">
          <div className="metric-label">
            <span>Cities</span>
            <span className="muted">
              {c.citiesTotal > 0
                ? `${formatPercent(c.cityPct)} · ${c.citiesVisited}/${c.citiesTotal} cities`
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
                ? `${formatPercent(c.regionPct)} · ${c.regionsVisited}/${c.regionsTotal} regions`
                : "dataset not loaded"}
            </span>
          </div>
          {c.regionsTotal > 0 && (
            <Bar value={c.regionPct} label={`${c.name}: regions visited`} color="var(--accent)" />
          )}
        </div>

        {c.heritageTotal > 0 && (
          <div className="metric">
            <div className="metric-label">
              <span>Sites &amp; landmarks</span>
              <span className="muted">
                {formatPercent(c.heritagePct)} · {c.heritageVisited}/{c.heritageTotal} sites
              </span>
            </div>
            <Bar
              value={c.heritagePct}
              label={`${c.name}: heritage sites visited`}
              color="var(--stat-want)"
            />
          </div>
        )}

        {detail && (
          <>
            <ChipRow
              label="Cities"
              names={detail.cities.map((x) => x.name)}
              done
              onPick={openByName(detail.cities)}
            />
            <ChipRow
              label="Regions visited"
              names={detail.regionsVisited}
              done
              hint="Show on the map:"
              onPick={flyToRegion}
            />
            <ChipRow
              label="Regions to visit"
              names={detail.regionsRemainingNames}
              onPick={flyToRegion}
            />
            <ChipRow
              label="Monuments seen"
              names={detail.monumentsVisited.map((m) => m.name)}
              done
              onPick={openByName(detail.monumentsVisited)}
            />
            <ChipRow
              label="Monuments to see"
              names={detail.monumentsRemaining.map((m) => m.name)}
              onPick={openByName(detail.monumentsRemaining)}
            />
          </>
        )}
      </div>
    </details>
  );
}

export function StatsView() {
  const ref = useMemo(() => getReferenceData(), []);
  const gazGen = useGazetteerGeneration(); // denominators change when the full gazetteer lands
  const visits = useVisits((s) => s.visits);
  const trips = useTrips((s) => s.trips);
  const flyTo = useUi((s) => s.flyTo);

  const scope = useSettings((s) => s.countryScope);
  const [sortBy, setSortBy] = useState<CountrySort>("cities");
  /* eslint-disable react-hooks/exhaustive-deps */
  const coverage = useMemo(() => computeCoverage(visits, ref, scope), [visits, ref, scope, gazGen]);
  const records = useMemo(() => computeRecords(visits, ref), [visits, ref, gazGen]);
  const travel = useMemo(() => travelTotals(trips, ref), [trips, ref]);

  function flyToCity(iso2: string) {
    return (name: string) => {
      const c = ref.citiesOf(iso2).find((x) => x.name === name);
      if (c) flyTo(c.lon, c.lat);
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
    [visits, ref, scope, gazGen],
  );
  const countries = useMemo(
    () => visitedCountriesList(visits, ref, sortBy, scope),
    [visits, ref, sortBy, scope, gazGen],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  // World-coverage %, with a floor so a real visit that rounds to 0 still reads
  // as progress rather than a discouraging "0%".
  const worldPctText = formatPercent(coverage.worldPct);
  const worldPctLabel =
    coverage.worldPct > 0 && worldPctText === formatPercent(0) ? "<1%" : worldPctText;

  // Continent constellation: a dot per continent, lit when it's been touched.
  // Antarctica only earns a dot once visited (nobody's "missing" Antarctica).
  const covByContinent = new Map(continentCov.map((c) => [c.continent, c] as const));
  const antarcticVisited = (covByContinent.get("Antarctic")?.visited ?? 0) > 0;
  const shownContinents = CONTINENT_ORDER.filter(
    (name) => name !== "Antarctic" || antarcticVisited,
  );
  const continentsVisited = continentCov.length;
  const totalContinents = shownContinents.length;

  return (
    <section aria-label="Statistics">
      <div className="section-head stats-head">
        <h2>Statistics</h2>
        <ScopeToggle />
      </div>

      {/* Coverage hero: the "how much of the world?" headline, then the raw
          counts demoted to a colored pill strip. Both open Places. */}
      <section className="stats-section" aria-labelledby="stats-coverage-h">
        <h3 id="stats-coverage-h">Coverage</h3>
        <div className="stats-hero">
          <button
            type="button"
            className="hero-ring"
            title="See your countries checklist"
            aria-label={`${formatInt(coverage.countriesVisited)} of ${formatInt(
              coverage.worldCountryCount,
            )} countries visited, ${worldPctLabel} — open your countries checklist`}
            onClick={() => useUi.getState().openPlaces("countries")}
          >
            <svg
              className="hero-ring-svg"
              viewBox="0 0 120 120"
              aria-hidden="true"
              focusable="false"
            >
              <circle className="hero-ring-track" cx="60" cy="60" r={RING_R} />
              <circle
                className="hero-ring-value"
                cx="60"
                cy="60"
                r={RING_R}
                transform="rotate(-90 60 60)"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - coverage.worldPct)}
              />
            </svg>
            <span className="hero-center">
              <span className="hero-num">{formatInt(coverage.countriesVisited)}</span>
              <span className="hero-den">/ {formatInt(coverage.worldCountryCount)}</span>
              <span className="hero-pct">{worldPctLabel}</span>
            </span>
          </button>

          <div className="hero-body">
            <p className="hero-caption">
              of {formatInt(coverage.worldCountryCount)}{" "}
              {scope === "un" ? "UN member states" : "countries & territories"}
            </p>
            <div className="continent-dots" aria-hidden="true">
              {shownContinents.map((name) => {
                const on = (covByContinent.get(name)?.visited ?? 0) > 0;
                return (
                  <span
                    key={name}
                    className={"cdot " + (on ? "on" : "off")}
                    style={
                      on
                        ? { background: CONTINENT_COLORS[name], borderColor: CONTINENT_COLORS[name] }
                        : undefined
                    }
                    title={name}
                  >
                    {on ? "✓" : ""}
                  </span>
                );
              })}
            </div>
            <p className="continents-touched">
              {formatInt(continentsVisited)} of {formatInt(totalContinents)} continents
            </p>
          </div>
        </div>

        <div className="kpi-row" aria-label="Your totals">
          <button
            type="button"
            className="kpi"
            title="See your visited places"
            onClick={() => useUi.getState().openPlaces("visited")}
          >
            <span className="kpi-num kpi-been">{formatInt(coverage.citiesVisited)}</span>
            <span className="kpi-label">cities</span>
          </button>
          {coverage.airportsVisited > 0 && (
            <button
              type="button"
              className="kpi"
              title="See your visited places"
              onClick={() => useUi.getState().openPlaces("visited")}
            >
              <span className="kpi-num kpi-air">{formatInt(coverage.airportsVisited)}</span>
              <span className="kpi-label">airports</span>
            </button>
          )}
          {coverage.monumentsVisited > 0 && (
            <button
              type="button"
              className="kpi"
              title="See the monuments list"
              onClick={() => useUi.getState().openPlaces("monuments")}
            >
              <span className="kpi-num kpi-want">{formatInt(coverage.monumentsVisited)}</span>
              <span className="kpi-label">monuments</span>
            </button>
          )}
        </div>
      </section>

      {continentCov.length > 0 && (
        <section className="stats-section" aria-labelledby="stats-continents-h">
          <h3 id="stats-continents-h">By continent</h3>
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
                    {c.visited}/{c.total} · {formatPercent(c.pct)}
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
        </section>
      )}

      {(records.northernmost || records.biggestCity || records.firstVisit) && (
        <section className="stats-section" aria-labelledby="stats-records-h">
          <h3 id="stats-records-h">Records</h3>
          <div className="records-grid">
            {records.northernmost && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🧭</span>
                <span>
                  Northernmost:{" "}
                  <RecordCity
                    name={records.northernmost.name}
                    onPick={flyToCity(records.northernmost.iso2)}
                  />{" "}
                  <span className="muted">({records.northernmost.lat.toFixed(1)}°)</span>
                </span>
              </div>
            )}
            {records.southernmost && records.southernmost.name !== records.northernmost?.name && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🐧</span>
                <span>
                  Southernmost:{" "}
                  <RecordCity
                    name={records.southernmost.name}
                    onPick={flyToCity(records.southernmost.iso2)}
                  />{" "}
                  <span className="muted">({records.southernmost.lat.toFixed(1)}°)</span>
                </span>
              </div>
            )}
            {records.biggestCity && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🏙️</span>
                <span>
                  Biggest city:{" "}
                  <RecordCity
                    name={records.biggestCity.name}
                    onPick={flyToCity(records.biggestCity.iso2)}
                  />{" "}
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
        </section>
      )}

      {travel.trips > 0 && (
        <section className="stats-section" aria-labelledby="stats-travel-h">
          <h3 id="stats-travel-h">Travel</h3>
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
        </section>
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

      {countries.map((c) => (
        <CountryRow key={c.iso2} c={c} flyToRegion={flyToRegion(c.iso2)} />
      ))}

      <p className="muted small">
        Computed against the loaded reference datasets: all countries &amp; territories (ISO
        3166-1), a GeoNames gazetteer of cities with 15,000+ people, and first-level regions
        (states/provinces) worldwide.
      </p>
    </section>
  );
}
