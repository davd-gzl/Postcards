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
import { countryFlag, formatDate, formatInt, formatKm, formatPercent } from "../../lib/format/format";
import { CONTINENT_COLORS, CONTINENT_ORDER } from "../../lib/reference/continents";
import { ScopeToggle } from "../../ui/ScopeToggle";
import { useT } from "../../lib/i18n";

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
  hint,
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
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  if (names.length === 0) return null;
  const shown = expanded ? names : names.slice(0, max);
  const hintText = hint ?? t("common.open");
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
            title={onPick ? `${hintText} ${n}` : undefined}
          >
            {n}
          </button>
        ))}
        {names.length > max && (
          <button type="button" className="place-chip chip-more" onClick={() => setExpanded((e) => !e)}>
            {expanded ? t("common.less") : t("common.moreCount", { count: names.length - max })}
          </button>
        )}
      </span>
    </div>
  );
}

/** A record's city name — a button that flies the map to it. */
function RecordCity({ name, onPick }: { name: string; onPick: (name: string) => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="country-open"
      title={t("stats.records.showOnMap", { name })}
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
  const t = useT();
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
          <span className="country-tag">{t("stats.country.citiesTag", { count: formatInt(c.citiesVisited) })}</span>
          <span className="country-tag">{t("stats.country.regionsTag", { count: formatInt(c.regionsVisited) })}</span>
          {c.heritageTotal > 0 && (
            <span className="country-tag">{t("stats.country.sitesTag", { count: formatInt(c.heritageVisited) })}</span>
          )}
        </span>
        <span className="country-caret" aria-hidden>
          ›
        </span>
        {c.citiesTotal > 0 && (
          <Bar value={c.cityPct} label={t("stats.country.cityBarAria", { name: c.name })} />
        )}
      </summary>

      <div className="country-body">
        <button
          type="button"
          className="country-open country-open-page"
          title={t("stats.country.open", { name: c.name })}
          onClick={() => useUi.getState().openCountry(c.iso2)}
        >
          <span className="flag" aria-hidden>
            {countryFlag(c.iso2)}
          </span>{" "}
          {t("stats.country.open", { name: c.name })}{" "}
          <span aria-hidden>↗</span>
        </button>

        <div className="metric">
          <div className="metric-label">
            <span>{t("stats.country.metricCities")}</span>
            <span className="muted">
              {c.citiesTotal > 0
                ? t("stats.country.metricCitiesDetail", {
                    pct: formatPercent(c.cityPct),
                    visited: c.citiesVisited,
                    total: c.citiesTotal,
                  })
                : t("stats.country.noCityData")}
            </span>
          </div>
          {c.citiesTotal > 0 && <Bar value={c.cityPct} label={t("stats.country.cityBarAria", { name: c.name })} />}
        </div>

        <div className="metric">
          <div className="metric-label">
            <span>{t("stats.country.metricRegions")}</span>
            <span className="muted">
              {c.regionsTotal > 0
                ? t("stats.country.metricRegionsDetail", {
                    pct: formatPercent(c.regionPct),
                    visited: c.regionsVisited,
                    total: c.regionsTotal,
                  })
                : t("stats.country.datasetNotLoaded")}
            </span>
          </div>
          {c.regionsTotal > 0 && (
            <Bar value={c.regionPct} label={t("stats.country.regionBarAria", { name: c.name })} color="var(--accent)" />
          )}
        </div>

        {c.heritageTotal > 0 && (
          <div className="metric">
            <div className="metric-label">
              <span>{t("stats.country.metricSites")}</span>
              <span className="muted">
                {t("stats.country.metricSitesDetail", {
                  pct: formatPercent(c.heritagePct),
                  visited: c.heritageVisited,
                  total: c.heritageTotal,
                })}
              </span>
            </div>
            <Bar
              value={c.heritagePct}
              label={t("stats.country.heritageBarAria", { name: c.name })}
              color="var(--stat-want)"
            />
          </div>
        )}

        {detail && (
          <>
            <ChipRow
              label={t("stats.country.chipCities")}
              names={detail.cities.map((x) => x.name)}
              done
              onPick={openByName(detail.cities)}
            />
            <ChipRow
              label={t("stats.country.chipRegionsVisited")}
              names={detail.regionsVisited}
              done
              hint={t("stats.country.showOnMapHint")}
              onPick={flyToRegion}
            />
            <ChipRow
              label={t("stats.country.chipRegionsToVisit")}
              names={detail.regionsRemainingNames}
              onPick={flyToRegion}
            />
            <ChipRow
              label={t("stats.country.chipMonumentsSeen")}
              names={detail.monumentsVisited.map((m) => m.name)}
              done
              onPick={openByName(detail.monumentsVisited)}
            />
            <ChipRow
              label={t("stats.country.chipMonumentsToSee")}
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
  const t = useT();
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
  // With only one visited city, northernmost = southernmost = biggest = that same
  // city, so the Records list repeats it. Only show the spatial superlatives once
  // there are at least two distinct cities to compare.
  const distinctCities = useMemo(
    () =>
      new Set(
        visits.filter((v) => v.place.kind === "city" && v.status === "visited").map((v) => v.place.id),
      ).size,
    [visits],
  );
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
    <section aria-label={t("stats.title")}>
      <div className="section-head stats-head">
        <h2>{t("stats.title")}</h2>
        <ScopeToggle />
      </div>

      {/* Coverage hero: the "how much of the world?" headline, then the raw
          counts demoted to a colored pill strip. Both open Places. */}
      <section className="stats-section" aria-labelledby="stats-coverage-h">
        <h3 id="stats-coverage-h">{t("stats.coverage.title")}</h3>
        <div className="stats-hero">
          <button
            type="button"
            className="hero-ring"
            title={t("stats.hero.title")}
            aria-label={t("stats.hero.aria", {
              visited: formatInt(coverage.countriesVisited),
              total: formatInt(coverage.worldCountryCount),
              pct: worldPctLabel,
            })}
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
              {t("stats.hero.ofCount", {
                count: formatInt(coverage.worldCountryCount),
                label: scope === "un" ? t("stats.scope.un") : t("stats.scope.all"),
              })}
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
              {t("stats.continents.count", {
                visited: formatInt(continentsVisited),
                total: formatInt(totalContinents),
              })}
            </p>
          </div>
        </div>

        <div className="kpi-row" aria-label={t("stats.totalsAria")}>
          <button
            type="button"
            className="kpi"
            title={t("stats.kpi.visitedTitle")}
            onClick={() => useUi.getState().openPlaces("visited")}
          >
            <span className="kpi-num kpi-been">{formatInt(coverage.citiesVisited)}</span>
            <span className="kpi-label">{t("stats.kpi.cities")}</span>
          </button>
          {coverage.airportsVisited > 0 && (
            <button
              type="button"
              className="kpi"
              title={t("stats.kpi.visitedTitle")}
              onClick={() => useUi.getState().openPlaces("visited")}
            >
              <span className="kpi-num kpi-air">{formatInt(coverage.airportsVisited)}</span>
              <span className="kpi-label">{t("stats.kpi.airports")}</span>
            </button>
          )}
          {coverage.monumentsVisited > 0 && (
            <button
              type="button"
              className="kpi"
              title={t("stats.kpi.monumentsTitle")}
              onClick={() => useUi.getState().openPlaces("monuments")}
            >
              <span className="kpi-num kpi-want">{formatInt(coverage.monumentsVisited)}</span>
              <span className="kpi-label">{t("stats.kpi.monuments")}</span>
            </button>
          )}
        </div>
      </section>

      {continentCov.length > 0 && (
        <section className="stats-section" aria-labelledby="stats-continents-h">
          <h3 id="stats-continents-h">{t("stats.byContinent.title")}</h3>
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
                  label={t("stats.continentBarAria", { continent: c.continent })}
                  color={CONTINENT_COLORS[c.continent]}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {((distinctCities >= 2 && (records.northernmost || records.biggestCity)) || records.firstVisit) && (
        <section className="stats-section" aria-labelledby="stats-records-h">
          <h3 id="stats-records-h">{t("stats.records.title")}</h3>
          <div className="records-grid">
            {distinctCities >= 2 && records.northernmost && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🧭</span>
                <span>
                  {t("stats.records.northernmost")}{" "}
                  <RecordCity
                    name={records.northernmost.name}
                    onPick={flyToCity(records.northernmost.iso2)}
                  />{" "}
                  <span className="muted">({records.northernmost.lat.toFixed(1)}°)</span>
                </span>
              </div>
            )}
            {distinctCities >= 2 && records.southernmost && records.southernmost.name !== records.northernmost?.name && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🐧</span>
                <span>
                  {t("stats.records.southernmost")}{" "}
                  <RecordCity
                    name={records.southernmost.name}
                    onPick={flyToCity(records.southernmost.iso2)}
                  />{" "}
                  <span className="muted">({records.southernmost.lat.toFixed(1)}°)</span>
                </span>
              </div>
            )}
            {distinctCities >= 2 && records.biggestCity && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🏙️</span>
                <span>
                  {t("stats.records.biggestCity")}{" "}
                  <RecordCity
                    name={records.biggestCity.name}
                    onPick={flyToCity(records.biggestCity.iso2)}
                  />{" "}
                  <span className="muted">
                    {t("stats.records.people", { count: formatInt(records.biggestCity.population) })}
                  </span>
                </span>
              </div>
            )}
            {records.firstVisit && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🌱</span>
                <span>
                  {t("stats.records.firstVisit")} <strong>{records.firstVisit.name}</strong>{" "}
                  <span className="muted">({formatDate(records.firstVisit.date)})</span>
                </span>
              </div>
            )}
            {records.latestVisit && records.latestVisit.date !== records.firstVisit?.date && (
              <div className="record">
                <span className="record-emoji" aria-hidden>🆕</span>
                <span>
                  {t("stats.records.latest")} <strong>{records.latestVisit.name}</strong>{" "}
                  <span className="muted">({formatDate(records.latestVisit.date)})</span>
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {travel.trips > 0 && (
        <section className="stats-section" aria-labelledby="stats-travel-h">
          <h3 id="stats-travel-h">{t("stats.travel.title")}</h3>
          <div className="travel-totals" aria-label={t("stats.travel.totalsAria")}>
            <span className="tt-main">
              <strong>{formatInt(travel.trips)}</strong>{" "}
              {t.plural("stats.travel.trips", travel.trips)}
            </span>
            <span className="tt-sep" aria-hidden />
            <span className="tt-main">
              <strong>{formatKm(travel.totalKm)}</strong> {t("stats.travel.travelled")}
            </span>
            {travel.byMode.length > 0 && (
              <span className="tt-modes">
                {travel.byMode.map((m) => (
                  <span
                    className="tt-mode"
                    key={m.mode}
                    title={t("stats.travel.modeTitle", { count: m.trips, mode: m.mode })}
                  >
                    {MODE_GLYPH[m.mode]} {m.trips}
                  </span>
                ))}
              </span>
            )}
          </div>
        </section>
      )}

      <div className="section-head">
        <h3>{t("stats.byCountry.title")}</h3>
        <label className="sort-label">
          <span className="sr-only">{t("stats.byCountry.sortAria")}</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CountrySort)}
          >
            <option value="cities">{t("stats.byCountry.sortCities")}</option>
            <option value="regions">{t("stats.byCountry.sortRegions")}</option>
            <option value="name">{t("stats.byCountry.sortName")}</option>
          </select>
        </label>
      </div>

      {countries.length === 0 && <p className="muted empty">{t("stats.byCountry.empty")}</p>}

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
