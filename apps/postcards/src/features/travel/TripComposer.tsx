import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useTrips } from "../../lib/store/useTrips";
import { countryFlag } from "../../lib/format/format";
import { useT, useLocale } from "../../lib/i18n";
import type { PlaceRef, TravelMode } from "../../lib/schema/models";
import { PlacePicker } from "./PlacePicker";
import { addStop, moveStop, removeStop } from "./tripStops";
import { tripPathKm } from "./distance";
import { parseTripDate } from "./tripDate";

const MODES: TravelMode[] = ["flight", "train", "bus", "ferry", "car", "other"];
const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/**
 * Full-page composer for a MULTI-STOP journey (spec 019). Assemble an ordered chain
 * of stops (airports + cities), name it, give it a rough date, and see the running
 * great-circle distance. Retrospective, not a planner — it records "what I did, and
 * roughly how far." A pure summary: saving never touches visit records.
 */
export function TripComposer({ tripId, onClose }: { tripId: string | null; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const ref = useMemo(() => getReferenceData(), []);
  const addTrip = useTrips((s) => s.addTrip);
  const updateTrip = useTrips((s) => s.updateTrip);
  const existing = useTrips((s) => (tripId ? s.trips.find((x) => x.tripId === tripId) : undefined));

  // Seed from an existing trip: its stops if any, else its from→to as two stops so
  // a legacy single-leg trip opens editable in the same page.
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
      // updateTrip trims/clears the label itself; an empty string drops the folder.
      await updateTrip(tripId, { from, to, stops, mode, date, name: name.trim() });
    } else {
      await addTrip({ from, to, stops, mode, date, name: name.trim() || null });
    }
    onClose();
  }

  return (
    <section className="screen trip-composer" aria-label={t(tripId ? "trip.compose.editTitle" : "trip.compose.newTitle")}>
      <div className="trip-composer-head">
        <button type="button" className="link back-link" onClick={onClose} aria-label={t("trip.compose.back")}>
          ← {t("trip.compose.back")}
        </button>
        <h2>{t(tripId ? "trip.compose.editTitle" : "trip.compose.newTitle")}</h2>
      </div>

      {/* Stops — the ordered chain */}
      <h3 className="trip-section-head">{t("trip.compose.stopsHeading")}</h3>
      <p className="muted small">{t("trip.compose.stopsHint")}</p>
      {stops.length === 0 ? (
        <p className="muted empty">{t("trip.compose.emptyStops")}</p>
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

      {/* Add a stop — aggregator-only search, restricted to airports + cities for
          the MVP. A stop is a kind-agnostic PlaceRef, so railway STATIONS slot in
          here unchanged once a named, openly-licensed station dataset exists
          (Constitution I: the app never invents reference data; missing data
          becomes a separate shareable dataset). Until then, no stations are offered
          and nothing breaks — the feature works on airports + cities. (spec 019 US4) */}
      <PlacePicker
        label={t("trip.compose.addStop")}
        placeholder={t("trip.compose.addStopPlaceholder")}
        value={null}
        include={["airport", "city"]}
        onPick={(place) => place && setStops((st) => addStop(st, place))}
      />

      {/* Distance readout */}
      <div className="trip-distance" role="status">
        <span className="trip-distance-label">{t("trip.compose.distanceLabel")}</span>
        <strong className="trip-distance-km">
          {t("trip.compose.km", { km: Math.round(km).toLocaleString(locale) })}
        </strong>
        {unresolvedLegs > 0 && <span className="muted small">{t("trip.compose.unmeasured")}</span>}
      </div>

      {/* Name, when, mode */}
      <div className="trip-composer-fields">
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

        <label className="field">
          <span className="field-label">{t("trip.compose.modeLabel")}</span>
          <select
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value as TravelMode)}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {t(`travel.mode.${m}` as const)}
              </option>
            ))}
          </select>
        </label>
      </div>

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
