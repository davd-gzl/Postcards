import { useMemo, useRef, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useStories } from "../../lib/store/useStories";
import { useUi } from "../../lib/store/useUi";
import { placeKey } from "../../lib/schema/helpers";
import { countryFlag, formatDate, formatInt, formatKm } from "../../lib/format/format";
import { haversineKm } from "../travel/distance";
import { articleUrl } from "../../lib/wikivoyage";
import { StateToggles } from "../visits/StateToggles";
import { PhotoGallery } from "../visits/PhotoGallery";
import { GuideSection } from "../guides/GuideButton";
import { CityLine } from "../../ui/CityLine";

/** Wikipedia article URL for a title (link only — nothing is fetched). */
function wikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;
}

/** When did you go, and what do you remember? (FR-002 — both optional.)
 *  The note saves on blur so IndexedDB isn't rewritten per keystroke. */
function VisitDetails({ visitId, date, note }: { visitId: string; date: string | null; note: string | null }) {
  const setDetails = useVisits((s) => s.setDetails);
  const [draft, setDraft] = useState(note ?? "");
  // A different visit (or an import) swapped in under the same mount.
  const lastVisit = useRef(visitId);
  if (lastVisit.current !== visitId) {
    lastVisit.current = visitId;
    setDraft(note ?? "");
  }
  return (
    <div className="visit-details">
      <label className="visit-field">
        <span className="muted small">Visited on</span>
        <input
          type="date"
          className="select"
          value={date ?? ""}
          onChange={(e) => void setDetails(visitId, { date: e.target.value || null })}
        />
      </label>
      <label className="visit-field visit-note">
        <span className="muted small">Note</span>
        <input
          type="text"
          className="select"
          placeholder="A memory, a tip, who you were with…"
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void setDetails(visitId, { note: draft })}
        />
      </label>
    </div>
  );
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
  const stories = useStories((s) => s.stories);
  const flyTo = useUi((s) => s.flyTo);
  const openJournalDraft = useUi((s) => s.openJournalDraft);

  // The page serves cities, World Heritage monuments, and your own custom places.
  const city = ref.cityById(cityId);
  const monument = !city ? ref.heritageById(cityId) : undefined;
  const visit = city
    ? findByPlace(visits, { kind: "city", id: city.id })
    : monument
      ? findByPlace(visits, { kind: "heritage", id: monument.id })
      : findByPlace(visits, { kind: "custom", id: cityId });
  const liveCustom = !city && !monument && visit?.place.kind === "custom" ? visit.place : null;
  // A custom place exists ONLY as its visit's embedded PlaceRef — remember it so
  // unchecking "Been there" on this very page doesn't collapse the header to
  // "Unknown place" and strand the user (the toggles must stay to re-add it).
  const lastCustom = useRef<{ id: string; place: NonNullable<typeof liveCustom> } | null>(null);
  if (liveCustom) lastCustom.current = { id: cityId, place: liveCustom };
  const customPlace =
    liveCustom ?? (lastCustom.current?.id === cityId ? lastCustom.current.place : null);

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

  // This place's journal stories (already newest-first in the store).
  const placeStories = useMemo(
    () => (place ? stories.filter((s) => placeKey(s.place) === placeKey(place)) : []),
    [stories, place],
  );

  // Nearby points of interest, by great-circle distance (nothing invented).
  // "Nearby" means easily travelable from here (≤ 30 km), not the same region.
  const nearby = useMemo(() => {
    if (lat == null || lon == null) return { monuments: [], airports: [] };
    const from = { lat, lon };
    const monuments = ref
      .allHeritage()
      // Never list the page's own monument as its "nearby" site at 0.0 km.
      .filter((h) => (h.lat !== 0 || h.lon !== 0) && h.id !== cityId)
      .map((h) => ({ ...h, km: haversineKm(from, h) }))
      .filter((h) => h.km <= 30)
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);
    const airports = ref
      .allAirports()
      .map((a) => ({ ...a, km: haversineKm(from, a) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
    return { monuments, airports };
  }, [ref, lat, lon, cityId]);

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
          search box.{" "}
          <button
            className="mini-btn"
            type="button"
            onClick={() => {
              useUi.getState().setTab("map");
              useUi.getState().focusSearch();
            }}
          >
            Search on the map
          </button>
        </p>
      )}

      {visit && (
        <section className="city-section">
          <h3>Your postcard</h3>
          <div className="city-gallery-row">
            <PhotoGallery visitId={visit.visitId} photos={visit.photos ?? []} placeName={name} />
          </div>
          {visit.status === "visited" && (
            <VisitDetails visitId={visit.visitId} date={visit.date} note={visit.note} />
          )}
        </section>
      )}

      {place && (placeStories.length > 0 || visit?.status === "visited") && (
        <section className="city-section">
          <h3>Journal</h3>
          {placeStories.length > 0 && (
            <ul className="city-list">
              {placeStories.map((s) => (
                <li key={s.storyId} className="city-row compact">
                  <div className="city-focus" style={{ cursor: "default" }}>
                    <CityLine flag="✍️" name={s.title} sub={<>· {formatDate(s.date)}</>} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            className="mini-btn"
            type="button"
            style={placeStories.length ? { marginTop: 6 } : undefined}
            onClick={() => openJournalDraft(place)}
          >
            ＋ Story
          </button>
        </section>
      )}

      {place && <GuideSection place={place} />}

      {place && (
        <section className="city-section">
          <h3>Learn & explore</h3>
          <div className="city-links">
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
