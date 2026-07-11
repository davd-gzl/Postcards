import { useMemo } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { countryFlag, formatDate, formatInt, formatKm } from "../../lib/format/format";
import { haversineKm } from "../travel/distance";
import { articleUrl } from "../../lib/wikivoyage";
import { StateToggles } from "../visits/StateToggles";
import { PhotoGallery } from "../visits/PhotoGallery";
import { GuideButton } from "../guides/GuideButton";
import { CityLine } from "../../ui/CityLine";

/** Wikipedia article URL for a title (link only — nothing is fetched). */
function wikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;
}

/**
 * The per-city page: everything the app knows about one place — reference facts,
 * your own records (visit, photos, note), nearby monuments & airports, and
 * outbound links (Wikivoyage, Wikipedia, OpenStreetMap). For places the datasets
 * don't know, it says so honestly and points to the add-your-own flow.
 */
export function CityScreen({ cityId, onBack }: { cityId: string; onBack: () => void }) {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const flyTo = useUi((s) => s.flyTo);

  // The page serves cities, World Heritage monuments, and your own custom places.
  const city = ref.cityById(cityId);
  const monument = !city ? ref.heritageById(cityId) : undefined;
  const visit = city
    ? findByPlace(visits, { kind: "city", id: city.id })
    : monument
      ? findByPlace(visits, { kind: "heritage", id: monument.id })
      : findByPlace(visits, { kind: "custom", id: cityId });
  const customPlace = !city && !monument && visit?.place.kind === "custom" ? visit.place : null;

  const name = city?.name ?? monument?.name ?? customPlace?.name ?? "Unknown place";
  const cc = city?.countryIso2 ?? monument?.countryIso2 ?? customPlace?.countryId ?? "";
  const country = ref.countryByIso2(cc);
  const region = city?.subdivisionId ? ref.subdivisionById(city.subdivisionId)?.name : null;
  const lat = city?.lat ?? (monument && (monument.lat !== 0 || monument.lon !== 0) ? monument.lat : null) ?? customPlace?.lat ?? null;
  const lon = city?.lon ?? (monument && (monument.lat !== 0 || monument.lon !== 0) ? monument.lon : null) ?? customPlace?.lon ?? null;
  const place = city
    ? { kind: "city" as const, id: city.id, name: city.name, countryId: city.countryIso2 }
    : monument
      ? { kind: "heritage" as const, id: monument.id, name: monument.name, countryId: monument.countryIso2 }
      : customPlace;

  // Nearby points of interest, by great-circle distance (nothing invented).
  const nearby = useMemo(() => {
    if (lat == null || lon == null) return { monuments: [], airports: [] };
    const from = { lat, lon };
    const monuments = ref
      .allHeritage()
      .filter((h) => h.lat !== 0 || h.lon !== 0)
      .map((h) => ({ ...h, km: haversineKm(from, h) }))
      .filter((h) => h.km < 300)
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);
    const airports = ref
      .allAirports()
      .map((a) => ({ ...a, km: haversineKm(from, a) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
    return { monuments, airports };
  }, [ref, lat, lon]);

  return (
    <div className="screen city-page">
      <button className="mini-btn back-btn" type="button" onClick={onBack}>
        ← Back
      </button>

      <header className="city-hero">
        <span className="city-hero-flag" aria-hidden>
          {countryFlag(cc)}
        </span>
        <div>
          <h2>{name}</h2>
          <p className="muted">
            {country?.name ?? cc}
            {region ? ` - ${region}` : ""}
            {monument ? " · UNESCO World Heritage Site" : ""}
            {customPlace ? " · your own place" : ""}
          </p>
        </div>
        {place && <StateToggles place={place} />}
      </header>

      <div className="city-facts">
        {city?.population != null && (
          <span className="fact">
            <strong>{formatInt(city.population)}</strong> people
          </span>
        )}
        {lat != null && lon != null && (
          <>
            <span className="fact">
              <strong>
                {lat.toFixed(3)}, {lon.toFixed(3)}
              </strong>{" "}
              lat, lon
            </span>
            <button className="mini-btn" type="button" onClick={() => flyTo(lon, lat)}>
              Show on map
            </button>
          </>
        )}
        {visit?.date && (
          <span className="fact">
            visited <strong>{formatDate(visit.date)}</strong>
          </span>
        )}
      </div>

      {!city && !monument && !customPlace && (
        <p className="notice">
          This place isn't in the loaded reference data, and you haven't created it yourself yet.
          Search for it on the Map tab — if it's missing there too, use “Add it yourself” under the
          search box.
        </p>
      )}

      {visit && (
        <section className="city-section">
          <h3>Your postcard</h3>
          <div className="city-gallery-row">
            <PhotoGallery visitId={visit.visitId} photos={visit.photos ?? []} placeName={name} />
            {visit.note && <p className="muted">{visit.note}</p>}
          </div>
        </section>
      )}

      {place && (
        <section className="city-section">
          <h3>Learn & explore</h3>
          <div className="city-links">
            <GuideButton place={place} className="mini-btn" />
            <a
              className="mini-btn"
              href={wikipediaUrl(country ? `${name}` : name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Wikipedia
            </a>
            <a
              className="mini-btn"
              href={articleUrl(name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Wikivoyage
            </a>
            {lat != null && lon != null && (
              <a
                className="mini-btn"
                href={`https://www.openstreetmap.org/#map=12/${lat}/${lon}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenStreetMap
              </a>
            )}
          </div>
          <p className="muted small">
            Links open in your browser — nothing is fetched until you tap one.
          </p>
        </section>
      )}

      {nearby.monuments.length > 0 && (
        <section className="city-section">
          <h3>World Heritage nearby</h3>
          <ul className="city-list">
            {nearby.monuments.map((h) => (
              <li key={h.id} className="city-row compact">
                <button className="city-focus" type="button" onClick={() => flyTo(h.lon, h.lat)}>
                  <CityLine flag="🏛️" name={h.name} sub={<>· {formatKm(h.km)} away</>} />
                </button>
                <StateToggles
                  place={{ kind: "heritage", id: h.id, name: h.name, countryId: h.countryIso2 }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {nearby.airports.length > 0 && (
        <section className="city-section">
          <h3>Nearest airports</h3>
          <ul className="city-list">
            {nearby.airports.map((a) => (
              <li key={a.id} className="city-row compact">
                <button className="city-focus" type="button" onClick={() => flyTo(a.lon, a.lat)}>
                  <CityLine
                    flag="✈️"
                    name={
                      <>
                        {a.name} ({a.id})
                      </>
                    }
                    sub={<>· {formatKm(a.km)} away</>}
                  />
                </button>
                <StateToggles
                  place={{ kind: "airport", id: a.id, name: `${a.name} (${a.id})`, countryId: a.countryIso2 }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
