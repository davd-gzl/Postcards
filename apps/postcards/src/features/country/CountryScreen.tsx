import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { computeCountryCoverage, countryDetail } from "../stats/computeStats";
import { countryFlag, formatInt, formatPercent } from "../../lib/format/format";
import { StateToggles } from "../visits/StateToggles";
import { GuideButton } from "../guides/GuideButton";
import { CityLine } from "../../ui/CityLine";

const PAGE = 50;

/**
 * The per-country page (opened from a Passport flag, a stats card, or the
 * countries checklist): what the country is made of — its cities, regions and
 * sites — and how much of it you've seen.
 */
export function CountryScreen({ iso2, onBack }: { iso2: string; onBack: () => void }) {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const flyTo = useUi((s) => s.flyTo);
  const [shown, setShown] = useState(PAGE);

  const country = ref.countryByIso2(iso2);
  const cities = useMemo(() => ref.citiesOf(iso2), [ref, iso2]); // population-desc
  const sites = useMemo(() => ref.heritageOf(iso2), [ref, iso2]);
  const languages = ref.languagesOf(iso2);
  const cov = useMemo(() => computeCountryCoverage(visits, ref, iso2), [visits, ref, iso2]);
  const detail = useMemo(() => countryDetail(visits, ref, iso2), [visits, ref, iso2]);

  if (!country) {
    return (
      <div className="screen city-page">
        <button className="mini-btn back-btn" type="button" onClick={onBack}>
          ← Back
        </button>
        <p className="notice">Unknown country code “{iso2}”.</p>
      </div>
    );
  }

  function showOnMap() {
    if (!cities.length) return;
    const lat = cities.reduce((s, c) => s + c.lat, 0) / cities.length;
    const lon = cities.reduce((s, c) => s + c.lon, 0) / cities.length;
    flyTo(lon, lat);
  }

  const place = { kind: "country" as const, id: iso2, name: country.name, countryId: iso2 };

  return (
    <div className="screen city-page">
      <button className="mini-btn back-btn" type="button" onClick={onBack}>
        ← Back
      </button>

      <header className="city-hero">
        <span className="city-hero-flag" aria-hidden>
          {countryFlag(iso2)}
        </span>
        <div>
          <h2>{country.name}</h2>
          <p className="muted">
            {country.continent}
            {languages.length > 0 && ` · ${languages.map((l) => l.name).join(", ")}`}
          </p>
        </div>
        <StateToggles place={place} />
      </header>

      <div className="city-facts">
        <span className="fact">
          <strong>{formatInt(country.cityCount)}</strong> cities & towns
        </span>
        <span className="fact">
          <strong>{formatInt(country.subdivisionCount)}</strong> regions
        </span>
        {sites.length > 0 && (
          <span className="fact">
            <strong>{formatInt(sites.length)}</strong> sites & landmarks
          </span>
        )}
        {cities.length > 0 && (
          <button className="mini-btn" type="button" onClick={showOnMap}>
            Show on map
          </button>
        )}
        <GuideButton place={place} />
      </div>

      <section className="city-section">
        <h3>Your coverage</h3>
        <div className="city-facts">
          <span className="fact">
            <strong>{formatPercent(cov.cityPct)}</strong> of cities ({cov.citiesVisited}/
            {cov.citiesTotal})
          </span>
          <span className="fact">
            <strong>{formatPercent(cov.regionPct)}</strong> of regions ({cov.regionsVisited}/
            {cov.regionsTotal})
          </span>
          {cov.heritageTotal > 0 && (
            <span className="fact">
              <strong>{formatPercent(cov.heritagePct)}</strong> of sites ({cov.heritageVisited}/
              {cov.heritageTotal})
            </span>
          )}
        </div>
        {detail.regionsRemainingNames.length > 0 && (
          <p className="muted small">
            Regions still to visit: {detail.regionsRemainingNames.slice(0, 12).join(", ")}
            {detail.regionsRemainingNames.length > 12
              ? ` +${detail.regionsRemainingNames.length - 12} more`
              : ""}
          </p>
        )}
      </section>

      {sites.length > 0 && (
        <section className="city-section">
          <h3>Sites & landmarks</h3>
          <ul className="city-list">
            {sites.map((h) => (
              <li key={h.id} className="city-row compact">
                <button
                  className="city-focus"
                  type="button"
                  onClick={() => useUi.getState().openCity(h.id)}
                >
                  <CityLine flag="🏛️" name={h.name} />
                </button>
                <StateToggles
                  place={{ kind: "heritage", id: h.id, name: h.name, countryId: h.countryIso2 }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="city-section">
        <h3>Cities & towns</h3>
        <ul className="city-list">
          {cities.slice(0, shown).map((c) => {
            const region = c.subdivisionId ? ref.subdivisionById(c.subdivisionId)?.name : null;
            return (
              <li key={c.id} className="city-row compact">
                <button
                  className="city-focus"
                  type="button"
                  onClick={() => useUi.getState().openCity(c.id)}
                >
                  <CityLine
                    flag={countryFlag(iso2)}
                    name={c.name}
                    sub={
                      <>
                        {region ? `· ${region}` : ""}
                        {c.population != null ? ` · ${formatInt(c.population)} people` : ""}
                      </>
                    }
                  />
                </button>
                <StateToggles
                  place={{ kind: "city", id: c.id, name: c.name, countryId: iso2 }}
                />
              </li>
            );
          })}
        </ul>
        {cities.length > shown && (
          <div className="list-pager">
            <span className="muted small">
              Showing the {shown} most populous of {formatInt(cities.length)}
            </span>
            <button className="mini-btn" type="button" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, cities.length - shown)} more
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
