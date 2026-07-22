import { useMemo, useState } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { useSettings } from "../../lib/store/useSettings";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useGazetteerGeneration } from "../../lib/reference/useGazetteer";
import {
  computeCoverage,
  computeCityBands,
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
import { useFilters } from "../../lib/store/useFilters";
import { countryFlag, formatDate, formatInt, formatKm, formatPercent } from "../../lib/format/format";
import { CONTINENT_COLORS, CONTINENT_ORDER } from "../../lib/reference/continents";
import { ScopeToggle } from "../../ui/ScopeToggle";
import { useT, type MessageKey } from "../../lib/i18n";

/** A row of tappable chips, capped so a huge country doesn't flood the card. */
/** A compact, readable list of place names as plain links — a label, a count, then
 *  names separated by "·", expandable past a small cap. Replaces the hard-to-read
 *  rounded-chip wall for regions/monuments (easier to scan, less visual weight). */
function NameList({
  label,
  items,
  onPick,
  hint,
  max = 12,
}: {
  label: string;
  items: string[];
  onPick: (name: string) => void;
  hint?: string;
  max?: number;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, max);
  const hintText = hint ?? t("common.open");
  return (
    <div className="name-list">
      <span className="name-list-label">
        {label} <span className="muted">· {items.length}</span>
      </span>
      <span className="name-list-names">
        {shown.map((n, i) => (
          <span key={n}>
            {i > 0 && (
              <span className="name-list-sep" aria-hidden>
                {" · "}
              </span>
            )}
            <button
              type="button"
              className="name-list-link"
              onClick={() => onPick(n)}
              title={`${hintText} ${n}`}
            >
              {n}
            </button>
          </span>
        ))}
        {items.length > max && (
          <button
            type="button"
            className="name-list-link name-list-more"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? t("common.less") : t("common.moreCount", { count: items.length - max })}
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
 * One country as a native <details>: the collapsed <summary> is a scannable row —
 * flag + name + a compact meter for the tiers that actually mean something (mega/
 * big cities and regions). Expanding reveals the same metrics with counts plus the
 * places still to explore, as plain readable lists (no chip wall). The overall
 * "cities %" (a sliver of every 15k+ town) is dropped — it read as noise. Detail
 * lists are lazy (computed on open), refreshed when the full gazetteer lands.
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
  const openByName = (list: { id: string; name: string }[]) => (name: string) => {
    const hit = list.find((x) => x.name === name);
    if (hit) useUi.getState().openCity(hit.id);
  };

  // Tapping a metric drills into Places, scoped to THIS country + the tier — and the
  // filter is the shared store, so it survives leaving and returning to the list.
  const drill = (view: "cities" | "monuments", minPop: number) => () => {
    useFilters.getState().set({ country: c.iso2, minPop, listOnly: false });
    useUi.getState().openPlaces(view);
  };
  // Cities coverage is a sliver of a huge denominator, so it often rounds to 0 —
  // floor a real, non-zero share to "<1%" so it never reads as "nothing seen".
  const pctText = (p: number) => {
    const s = formatPercent(p);
    return p > 0 && s === formatPercent(0) ? "<1%" : s;
  };

  // Slim summary meter: a tiny label + percentage + bar.
  const meter = (labelKey: MessageKey, ariaKey: MessageKey, pctVal: number, color?: string) => (
    <div className="cmeter">
      <span className="cmeter-cap">
        {t(labelKey)} <b>{pctText(pctVal)}</b>
      </span>
      <Bar value={pctVal} label={t(ariaKey, { name: c.name })} color={color} />
    </div>
  );
  // Full metric row (expanded): label, "x/y · pct" detail, bar. With an onClick it
  // renders as a button that opens the matching, country-scoped Places list.
  const metric = (
    labelKey: MessageKey,
    detailKey: MessageKey,
    ariaKey: MessageKey,
    visited: number,
    total: number,
    pctVal: number,
    color: string | undefined,
    onClick?: () => void,
  ) => {
    const body = (
      <>
        <div className="metric-label">
          <span>{t(labelKey)}</span>
          <span className="muted">{t(detailKey, { pct: pctText(pctVal), visited, total })}</span>
        </div>
        <Bar value={pctVal} label={t(ariaKey, { name: c.name })} color={color} />
      </>
    );
    if (!onClick) return <div className="metric">{body}</div>;
    return (
      <button
        type="button"
        className="metric metric-btn"
        onClick={onClick}
        title={t("stats.country.exploreHint", { label: t(labelKey), name: c.name })}
      >
        {body}
      </button>
    );
  };

  const hasMega = c.megaCitiesTotal > 0;
  const MEGA_COLOR = "var(--stat-fav)";
  const BIG_COLOR = "var(--stat-been)";
  const CITY_COLOR = "var(--stat-air)";
  const REGION_COLOR = "var(--accent)";

  return (
    <details className="country-card" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="country-summary">
        {/* Flag + name shown ONCE here (the expanded body no longer repeats them). */}
        <span className="country-name">
          <span className="flag" aria-hidden>
            {countryFlag(c.iso2)}
          </span>{" "}
          {c.name}
        </span>
        <span className="country-caret" aria-hidden>
          ›
        </span>
        {/* Coverage tiers at a glance — cities (all), big (100k+), mega (1M+) and
            regions. Hidden once open (the body shows the same, with counts and as
            tappable drill-downs) so nothing is duplicated. */}
        {(c.citiesTotal > 0 || c.regionsTotal > 0) && (
          <div className="country-meters">
            {c.citiesTotal > 0 &&
              meter("stats.country.metricCities", "stats.country.cityBarAria", c.cityPct, CITY_COLOR)}
            {c.bigCitiesTotal > 0 &&
              meter("stats.country.metricBigCities", "stats.country.bigCityBarAria", c.bigCityPct, BIG_COLOR)}
            {hasMega && meter("stats.country.metricMega", "stats.country.megaCityBarAria", c.megaCityPct, MEGA_COLOR)}
            {c.regionsTotal > 0 &&
              meter("stats.country.metricRegions", "stats.country.regionBarAria", c.regionPct, REGION_COLOR)}
          </div>
        )}
      </summary>

      <div className="country-body">
        {/* Open the full page — no repeated flag/name (that was "France" twice). */}
        <button
          type="button"
          className="country-open-page link"
          onClick={() => useUi.getState().openCountry(c.iso2)}
        >
          {t("stats.country.openPage")} <span aria-hidden>↗</span>
        </button>

        {/* Each tier is tappable — it opens Places filtered to this country + tier,
            so you can browse (and add) exactly what it counts. The three city
            tiers share one row; regions + sites sit on the row below. Regions have
            no Places list of their own, so that one opens the country's full page. */}
        <div className="tier-grid">
          {c.citiesTotal > 0 &&
            metric(
              "stats.country.metricCities",
              "stats.country.metricCitiesDetail",
              "stats.country.cityBarAria",
              c.citiesVisited,
              c.citiesTotal,
              c.cityPct,
              CITY_COLOR,
              drill("cities", 0),
            )}
          {c.bigCitiesTotal > 0 &&
            metric(
              "stats.country.metricBigCities",
              "stats.country.metricBigCitiesDetail",
              "stats.country.bigCityBarAria",
              c.bigCitiesVisited,
              c.bigCitiesTotal,
              c.bigCityPct,
              BIG_COLOR,
              drill("cities", 100_000),
            )}
          {hasMega &&
            metric(
              "stats.country.metricMega",
              "stats.country.metricMegaDetail",
              "stats.country.megaCityBarAria",
              c.megaCitiesVisited,
              c.megaCitiesTotal,
              c.megaCityPct,
              MEGA_COLOR,
              drill("cities", 1_000_000),
            )}
        </div>
        <div className="tier-grid">
          {c.regionsTotal > 0 &&
            metric(
              "stats.country.metricRegions",
              "stats.country.metricRegionsDetail",
              "stats.country.regionBarAria",
              c.regionsVisited,
              c.regionsTotal,
              c.regionPct,
              REGION_COLOR,
              () => useUi.getState().openCountry(c.iso2),
            )}
          {c.heritageTotal > 0 &&
            metric(
              "stats.country.metricSites",
              "stats.country.metricSitesDetail",
              "stats.country.heritageBarAria",
              c.heritageVisited,
              c.heritageTotal,
              c.heritagePct,
              "var(--stat-want)",
              drill("monuments", 0),
            )}
        </div>

        {detail && (
          <>
            {/* What's LEFT to explore — plain, scannable name lists (not a chip wall). */}
            <NameList
              label={t("stats.country.chipRegionsToVisit")}
              items={detail.regionsRemainingNames}
              onPick={flyToRegion}
            />
            <NameList
              label={t("stats.country.chipMonumentsToSee")}
              items={detail.monumentsRemaining.map((m) => m.name)}
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
  const bands = useMemo(() => computeCityBands(visits, ref), [visits, ref, gazGen]);
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
      // A record tile ("Show X on the map") opens the city's marker card, same
      // as tapping its dot — not just a silent re-centre.
      if (c)
        useUi.getState().selectPlace(c.lon, c.lat, {
          kind: "city",
          id: c.id,
          name: c.name,
          countryId: c.countryIso2,
        });
    };
  }
  // Open the visited Places list narrowed to a population band (0 = all cities,
  // 100k = big cities, 1M = megacities) via the app's ONE shared filter, so the
  // tile drills into exactly the cities it counts.
  function openCitiesFiltered(minPop: number) {
    // A world-level tile: clear any country drill-down a card left set, so this
    // shows the tier across every country, not just the last one you opened.
    useFilters.getState().set({ minPop, country: "" });
    useUi.getState().openPlaces("visited");
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
  // City coverage is a sliver of a huge denominator (every 15k+ town on Earth),
  // so a real visit almost always rounds to 0% — floor it to "<1%" so progress
  // never reads as nothing.
  const cityPctText = formatPercent(coverage.cityPct);
  const cityPctLabel =
    coverage.cityPct > 0 && cityPctText === formatPercent(0) ? "<1%" : cityPctText;

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
        {/* Two headline progress bars — read your coverage at a glance, before
            opening any country. Countries, and cities (every gazetteer city,
            15k+ people) — the coverage metric that keeps growing for years.
            ("Big cities", 100k+, is a per-country meter in the list below.) */}
        <div className="stats-bars">
          <button
            type="button"
            className="stat-bar"
            title={t("stats.hero.title")}
            aria-label={t("stats.bars.countriesAria", {
              visited: formatInt(coverage.countriesVisited),
              total: formatInt(coverage.worldCountryCount),
              pct: worldPctLabel,
            })}
            onClick={() => useUi.getState().openPlaces("countries")}
          >
            <span className="stat-bar-top">
              <span className="stat-bar-name">{t("stats.bars.countries")}</span>
              <span className="stat-bar-fig">
                <strong>{formatInt(coverage.countriesVisited)}</strong>
                <span className="muted">
                  {" "}
                  / {formatInt(coverage.worldCountryCount)} · {worldPctLabel}
                </span>
              </span>
            </span>
            <Bar value={coverage.worldPct} label={t("stats.bars.countries")} />
          </button>

          <button
            type="button"
            className="stat-bar"
            title={t("stats.bars.citiesTitle")}
            aria-label={t("stats.bars.citiesAria", {
              visited: formatInt(coverage.citiesVisited),
              total: formatInt(coverage.worldCityCount),
              pct: cityPctLabel,
            })}
            onClick={() => useUi.getState().openPlaces("visited")}
          >
            <span className="stat-bar-top">
              <span className="stat-bar-name">{t("stats.bars.cities")}</span>
              <span className="stat-bar-fig">
                <strong>{formatInt(coverage.citiesVisited)}</strong>
                <span className="muted">
                  {" "}
                  / {formatInt(coverage.worldCityCount)} · {cityPctLabel}
                </span>
              </span>
            </span>
            <Bar value={coverage.cityPct} label={t("stats.bars.cities")} color="var(--accent)" />
          </button>
        </div>

        <div className="stats-continents">
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

        <div className="kpi-row" aria-label={t("stats.totalsAria")}>
          <button
            type="button"
            className="kpi kpi-hero"
            title={t("stats.kpi.visitedTitle")}
            onClick={() => openCitiesFiltered(0)}
          >
            <span className="kpi-num kpi-been">{formatInt(coverage.citiesVisited)}</span>
            <span className="kpi-label">{t("stats.kpi.cities")}</span>
          </button>
          <button
            type="button"
            className="kpi"
            title={t("stats.kpi.countriesTitle")}
            onClick={() => useUi.getState().openPlaces("countries")}
          >
            <span className="kpi-num kpi-air">{formatInt(coverage.countriesVisited)}</span>
            <span className="kpi-label">{t("stats.kpi.countries")}</span>
          </button>
          {bands.mega + bands.large > 0 && (
            <button
              type="button"
              className="kpi"
              title={t("stats.kpi.visitedTitle")}
              onClick={() => openCitiesFiltered(100_000)}
            >
              <span className="kpi-num kpi-been">{formatInt(bands.mega + bands.large)}</span>
              <span className="kpi-label">{t("stats.kpi.bigCities")}</span>
            </button>
          )}
          {bands.mega > 0 && (
            <button
              type="button"
              className="kpi"
              title={t("stats.kpi.visitedTitle")}
              onClick={() => openCitiesFiltered(1_000_000)}
            >
              <span className="kpi-num kpi-been">{formatInt(bands.mega)}</span>
              <span className="kpi-label">{t("stats.kpi.megaCities")}</span>
            </button>
          )}
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

      {bands.total > 0 && (
        <section className="stats-section" aria-labelledby="stats-bands-h">
          <h3 id="stats-bands-h">{t("stats.bands.title")}</h3>
          <div
            className="size-bar"
            role="img"
            aria-label={t("stats.bands.aria", {
              mega: formatInt(bands.mega),
              large: formatInt(bands.large),
              small: formatInt(bands.small),
            })}
          >
            {bands.mega > 0 && (
              <span className="size-seg seg-mega" style={{ flexGrow: bands.mega }} />
            )}
            {bands.large > 0 && (
              <span className="size-seg seg-large" style={{ flexGrow: bands.large }} />
            )}
            {bands.small > 0 && (
              <span className="size-seg seg-small" style={{ flexGrow: bands.small }} />
            )}
          </div>
          <ul className="size-legend">
            <li>
              <span className="size-dot seg-mega" aria-hidden />
              <strong>{formatInt(bands.mega)}</strong> {t("stats.bands.mega")}
            </li>
            <li>
              <span className="size-dot seg-large" aria-hidden />
              <strong>{formatInt(bands.large)}</strong> {t("stats.bands.large")}
            </li>
            <li>
              <span className="size-dot seg-small" aria-hidden />
              <strong>{formatInt(bands.small)}</strong> {t("stats.bands.small")}
            </li>
          </ul>
        </section>
      )}

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
