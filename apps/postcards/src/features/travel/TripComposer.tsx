import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useTrips } from "../../lib/store/useTrips";
import { useVisits } from "../../lib/store/useVisits";
import { placeKey } from "../../lib/schema/helpers";
import { countryFlag } from "../../lib/format/format";
import { useT, useLocale } from "../../lib/i18n";
import type { PlaceRef, TravelMode } from "../../lib/schema/models";
import { MyPlacesPicker } from "./MyPlacesPicker";
import { myPlaces } from "./myPlaces";
import { addStop, moveStop, removeStop } from "./tripStops";
import { tripPathKm } from "./distance";
import { parseTripDate } from "./tripDate";

const MODES: TravelMode[] = ["flight", "train", "bus", "ferry", "car", "other"];
const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/**
 * Full-page composer for a MULTI-STOP journey (spec 019). Built to be fast: tap the
 * places you've BEEN (a list or a map, with flags) to build an ordered chain, see
 * the running great-circle distance, and save — the date is optional and can be
 * added later. Retrospective, not a planner; a pure summary (visits untouched).
 */
export function TripComposer({ tripId, onClose }: { tripId: string | null; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const ref = useMemo(() => getReferenceData(), []);
  const trips = useTrips((s) => s.trips);
  const visits = useVisits((s) => s.visits);
  const addTrip = useTrips((s) => s.addTrip);
  const updateTrip = useTrips((s) => s.updateTrip);
  const existing = useMemo(
    () => (tripId ? trips.find((x) => x.tripId === tripId) : undefined),
    [tripId, trips],
  );

  // The pool of places you've been — visited records + places already used in trips.
  const pool = useMemo(() => myPlaces(visits, trips, ref), [visits, trips, ref]);

  const [stops, setStops] = useState<PlaceRef[]>(() => {
    if (existing?.stops && existing.stops.length >= 2) return existing.stops;
    if (existing) return [existing.from, existing.to];
    return [];
  });
  const [name, setName] = useState(existing?.name ?? "");
  const [mode, setMode] = useState<TravelMode>(existing?.mode ?? "flight");
  const seededDate = parseTripDate(existing?.date ?? null);
  const [year, setYear] = useState(seededDate ? String(seededDate.year) : "");
  const [month, setMonth] = useState(
    seededDate?.month != null ? String(seededDate.month).padStart(2, "0") : "",
  );

  const addedKeys = useMemo(() => new Set(stops.map((s) => placeKey(s))), [stops]);
  const { km, unresolvedLegs } = useMemo(() => tripPathKm(stops, ref), [stops, ref]);
  const canSave = stops.length >= 2;

  const monthName = (mm: string) =>
    new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(Date.UTC(2000, Number(mm) - 1, 1)));

  function composeDate(): string | null {
    const y = year.trim();
    if (!/^\d{4}$/.test(y)) return null;
    return month ? `${y}-${month}` : y;
  }

  async function save() {
    if (!canSave) return;
    const from = stops[0]!;
    const to = stops[stops.length - 1]!;
    const date = composeDate();
    if (tripId && existing) {
      await updateTrip(tripId, { from, to, stops, mode, date, name: name.trim() });
    } else {
      await addTrip({ from, to, stops, mode, date, name: name.trim() || null });
    }
    onClose();
  }

  return (
    <section
      className="screen trip-composer"
      aria-label={t(tripId ? "trip.compose.editTitle" : "trip.compose.newTitle")}
    >
      <div className="trip-composer-head">
        <button
          type="button"
          className="link back-link"
          onClick={onClose}
          aria-label={t("trip.compose.back")}
        >
          ← {t("trip.compose.back")}
        </button>
        <h2>{t(tripId ? "trip.compose.editTitle" : "trip.compose.newTitle")}</h2>
      </div>

      {/* Your trip — the ordered chain being built, with the running distance. */}
      <div className="trip-chain-head">
        <h3 className="trip-section-head">{t("trip.compose.stopsHeading")}</h3>
        {stops.length >= 2 && (
          <span className="trip-distance-km" role="status">
            {t("trip.compose.km", { km: Math.round(km).toLocaleString(locale) })}
          </span>
        )}
      </div>
      {stops.length === 0 ? (
        <p className="muted small">{t("trip.compose.emptyStops")}</p>
      ) : (
        <ol className="trip-stops">
          {stops.map((s, i) => (
            <li key={`${s.kind}:${s.id}:${i}`} className="trip-stop-row">
              <span className="trip-stop-index" aria-hidden>
                {i + 1}
              </span>
              <span className="flag" aria-hidden>
                {s.kind === "airport" ? "✈️" : countryFlag(s.countryId)}
              </span>
              <span className="trip-stop-name" title={s.name}>
                {s.name}
              </span>
              <span className="trip-stop-actions">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={i === 0}
                  aria-label={t("trip.compose.moveUp", { name: s.name })}
                  onClick={() => setStops((st) => moveStop(st, i, i - 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={i === stops.length - 1}
                  aria-label={t("trip.compose.moveDown", { name: s.name })}
                  onClick={() => setStops((st) => moveStop(st, i, i + 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t("trip.compose.removeStop", { name: s.name })}
                  onClick={() => setStops((st) => removeStop(st, i))}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {unresolvedLegs > 0 && <p className="muted small">{t("trip.compose.unmeasured")}</p>}

      {/* Pick from the places you've been — the fast, primary interaction. */}
      <h3 className="trip-section-head">{t("trip.compose.pickHeading")}</h3>
      <p className="muted small">{t("trip.compose.tapHint")}</p>
      <MyPlacesPicker
        places={pool}
        addedKeys={addedKeys}
        onPick={(place) => setStops((st) => addStop(st, place))}
        stops={stops}
        travelMode={mode}
      />

      {/* Optional details — name now, date whenever. */}
      <label className="field">
        <span className="field-label">{t("trip.compose.nameLabel")}</span>
        <input
          className="search-input"
          type="text"
          maxLength={80}
          value={name}
          placeholder={t("trip.compose.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">{t("trip.compose.modeLabel")}</span>
        <select className="select" value={mode} onChange={(e) => setMode(e.target.value as TravelMode)}>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {t(`travel.mode.${m}` as const)}
            </option>
          ))}
        </select>
      </label>

      <details className="trip-date-details" open={!!year}>
        <summary>{t("trip.compose.addDate")}</summary>
        <fieldset className="field trip-when">
          <legend className="field-label">{t("trip.compose.whenLabel")}</legend>
          <input
            className="search-input trip-year"
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            value={year}
            placeholder={t("trip.compose.yearPlaceholder")}
            aria-label={t("trip.compose.yearPlaceholder")}
            onChange={(e) => setYear(e.target.value)}
          />
          <select
            className="select"
            value={month}
            aria-label={t("trip.compose.monthLabel")}
            disabled={!/^\d{4}$/.test(year.trim())}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="">{t("trip.compose.monthAny")}</option>
            {MONTHS.map((mm) => (
              <option key={mm} value={mm}>
                {monthName(mm)}
              </option>
            ))}
          </select>
        </fieldset>
      </details>

      <div className="trip-composer-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button type="button" className="btn" disabled={!canSave} onClick={() => void save()}>
          {t("trip.compose.save")}
        </button>
      </div>
      {!canSave && <p className="muted small">{t("trip.compose.needTwo")}</p>}
    </section>
  );
}
