import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useTrips } from "../../lib/store/useTrips";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { formatDate, formatKm } from "../../lib/format/format";
import type { PlaceRef, TravelMode, Trip } from "../../lib/schema/models";
import { julianToDate, type BcbpResult } from "../../lib/bcbp/parse";
import { CityLine } from "../../ui/CityLine";
import { PlacePicker } from "./PlacePicker";
import { BoardingPassImport } from "./BoardingPassImport";
import { travelTotals, tripDistanceKm } from "./distance";
import { MODE_GLYPH, MODE_LABEL, MODE_ORDER } from "./modes";
import {
  MONTH_NAMES,
  periodLabel,
  tripMonths,
  tripYears,
  tripsInPeriod,
  type MonthFilter,
  type YearFilter,
} from "./period";

const MODES = MODE_ORDER.map((value) => ({ value, label: MODE_LABEL[value] }));

/** Compact endpoint label: the IATA code for airports (names are long), else the place name. */
function endpointLabel(p: PlaceRef): string {
  return p.kind === "airport" ? p.id : p.name;
}

interface TripFields {
  from: PlaceRef | null;
  to: PlaceRef | null;
  mode: TravelMode;
  date: string;
  note: string;
}

const EMPTY_FIELDS: TripFields = { from: null, to: null, mode: "flight", date: "", note: "" };

/**
 * The add/edit form. Its fields are local state so keystrokes re-render only
 * the form — never the trip list above and below it. The parent remounts it
 * (via key) whenever it prefills values: an edit, a scanned pass, or a reset.
 */
function TripForm({
  initial,
  editing,
  onSave,
  onCancel,
}: {
  initial: TripFields;
  editing: boolean;
  onSave: (fields: TripFields) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState<PlaceRef | null>(initial.from);
  const [to, setTo] = useState<PlaceRef | null>(initial.to);
  const [mode, setMode] = useState<TravelMode>(initial.mode);
  const [date, setDate] = useState(initial.date);
  const [note, setNote] = useState(initial.note);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    onSave({ from, to, mode, date, note });
  }

  return (
    <form className="trip-form" onSubmit={onSubmit}>
      {editing && <p className="editing-note">Editing a trip</p>}
      <PlacePicker label="From" value={from} onPick={setFrom} />
      <PlacePicker label="To" value={to} onPick={setTo} />
      <div className="trip-form-row">
        <label className="picker-label" htmlFor="trip-mode">
          Mode
          <select
            id="trip-mode"
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value as TravelMode)}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {MODE_GLYPH[m.value]} {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="picker-label" htmlFor="trip-date">
          Date (optional)
          <input
            id="trip-date"
            className="select"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <label className="picker-label" htmlFor="trip-note">
        Note (optional)
        <input
          id="trip-note"
          className="select"
          type="text"
          maxLength={120}
          placeholder="Flight AC834, seat 12A…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="trip-form-actions">
        <button className="btn" type="submit" disabled={!from || !to}>
          {editing ? "Save changes" : "Add trip"}
        </button>
        {editing && (
          <button className="btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** Log of journeys you've taken: add a trip, see per-trip distance and totals. */
export function TravelScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const trips = useTrips((s) => s.trips);
  const addTrip = useTrips((s) => s.addTrip);
  const updateTrip = useTrips((s) => s.updateTrip);
  const removeTrip = useTrips((s) => s.removeTrip);
  const setAll = useTrips((s) => s.setAll);
  const showToast = useToast((s) => s.show);

  // The form itself holds its fields (see TripForm); the parent only keeps what
  // to prefill it with, and a key that remounts it when a new prefill arrives.
  const [draft, setDraft] = useState<TripFields>(EMPTY_FIELDS);
  const [formKey, setFormKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  // The period filter is shared (via useUi) so the map's trip arcs match it.
  const year = useUi((s) => s.tripYear) as YearFilter;
  const month = useUi((s) => s.tripMonth) as MonthFilter;
  const setTripPeriod = useUi((s) => s.setTripPeriod);

  const years = useMemo(() => tripYears(trips), [trips]);
  const months = useMemo(() => (year === "all" ? [] : tripMonths(trips, year)), [trips, year]);
  const filtered = useMemo(() => tripsInPeriod(trips, year, month), [trips, year, month]);

  const totals = useMemo(() => travelTotals(filtered, ref), [filtered, ref]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [filtered],
  );

  function pickYear(y: YearFilter) {
    setTripPeriod(y, "all"); // month options depend on the year; reset to avoid a stale one
  }
  function pickMonth(m: MonthFilter) {
    setTripPeriod(year, m);
  }

  // The filter is shared and persisted across sessions, but trips change under it
  // (e.g. deleting every trip in the filtered year). Reconcile so the stored
  // period can never point at a year/month that no longer exists — otherwise the
  // <select> shows a phantom value and the map silently hides all arcs.
  useEffect(() => {
    if (year !== "all" && !years.includes(year)) setTripPeriod("all", "all");
    else if (year !== "all" && month !== "all" && !months.includes(month)) setTripPeriod(year, "all");
  }, [years, months, year, month, setTripPeriod]);

  /** Remount the form with these fields (and, for an edit, the trip being edited). */
  function loadForm(fields: TripFields, tripId: string | null = null) {
    setDraft(fields);
    setEditingId(tripId);
    setFormKey((k) => k + 1);
  }

  function resetForm() {
    loadForm(EMPTY_FIELDS);
  }

  function startEdit(t: Trip) {
    loadForm(
      { from: t.from, to: t.to, mode: t.mode, date: t.date ?? "", note: t.note ?? "" },
      t.tripId,
    );
    document.querySelector(".trip-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveTrip({ from, to, mode, date, note }: TripFields) {
    if (!from || !to) return;
    const prev = useTrips.getState().trips;
    const fields = { from, to, mode, date: date || null, note: note.trim() || null };
    if (editingId) {
      await updateTrip(editingId, fields);
      showToast(`Updated ${endpointLabel(from)} → ${endpointLabel(to)}`, () => setAll(prev));
    } else {
      await addTrip(fields);
      showToast(`Added ${endpointLabel(from)} → ${endpointLabel(to)}`, () => setAll(prev));
    }
    resetForm();
  }

  // Escape backs out of the screen's transient states: the edit mode or the
  // boarding-pass panel (claimed here so it doesn't also navigate back).
  function onEscape(e: React.KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (passOpen) {
      setPassOpen(false);
      e.stopPropagation();
    } else if (editingId) {
      resetForm();
      e.stopPropagation();
    }
  }

  function removeWithUndo(tripId: string, label: string) {
    const prev = useTrips.getState().trips;
    void removeTrip(tripId);
    showToast(`Removed ${label}`, () => setAll(prev));
  }

  function airportRef(iata: string): PlaceRef | null {
    const a = ref.airportById(iata);
    return a ? { kind: "airport", id: a.id, name: `${a.name} (${a.id})`, countryId: a.countryIso2 } : null;
  }

  /** A parsed boarding pass: prefill the form for one leg, or log every leg of a connection. */
  async function handleScan(result: BcbpResult) {
    setEditingId(null); // a scanned pass always creates new trips
    const now = new Date();
    const legs = result.legs.map((l) => ({
      from: airportRef(l.from),
      to: airportRef(l.to),
      date: julianToDate(l.julianDay, now),
      flight: `${l.carrier}${l.flightNumber}`.trim(), // e.g. "AC834" (may be empty)
      codes: [l.from, l.to] as const,
    }));

    if (legs.length === 1) {
      const leg = legs[0]!;
      // Always replace both endpoints — clear an unresolved code so the field the
      // toast asks the user to fill is actually empty (never a stale leftover).
      loadForm({
        from: leg.from ?? null,
        to: leg.to ?? null,
        mode: "flight",
        date: leg.date,
        note: leg.flight ? `Flight ${leg.flight}` : "",
      });
      const missing = [!leg.from && leg.codes[0], !leg.to && leg.codes[1]].filter(Boolean);
      showToast(
        missing.length
          ? `Read ${leg.codes[0]}→${leg.codes[1]} — ${missing.join(", ")} isn't in the airport data; pick it manually.`
          : `Read ${leg.codes[0]} → ${leg.codes[1]} — review the trip and save.`,
      );
      return;
    }

    // Connection: log every fully-resolved leg as a flight, with a single undo.
    const prev = useTrips.getState().trips;
    let added = 0;
    const skipped: string[] = [];
    for (const leg of legs) {
      if (leg.from && leg.to) {
        await addTrip({
          from: leg.from,
          to: leg.to,
          mode: "flight",
          date: leg.date,
          note: leg.flight ? `Flight ${leg.flight}` : null,
        });
        added++;
      } else {
        skipped.push(`${leg.codes[0]}→${leg.codes[1]}`);
      }
    }
    showToast(
      `Added ${added} flight${added === 1 ? "" : "s"} from your pass` +
        (skipped.length ? ` (skipped ${skipped.join(", ")})` : ""),
      () => setAll(prev),
    );
  }

  return (
    <section aria-label="Travel log" onKeyDown={onEscape}>
      <div className="section-head">
        <h2>Travel log</h2>
      </div>

      {years.length > 0 && (
        <div className="travel-filter trip-form-row" role="group" aria-label="Filter trips by time">
          <label className="picker-label" htmlFor="trip-filter-year">
            Year
            <select
              id="trip-filter-year"
              className="select"
              value={year}
              onChange={(e) => pickYear(e.target.value as YearFilter)}
            >
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          {year !== "all" && months.length > 0 && (
            <label className="picker-label" htmlFor="trip-filter-month">
              Month
              <select
                id="trip-filter-month"
                className="select"
                value={month}
                onChange={(e) => pickMonth(e.target.value as MonthFilter)}
              >
                <option value="all">All months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {MONTH_NAMES[Number(m) - 1]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div
        className="travel-totals"
        aria-label={
          periodLabel(year, month)
            ? `Travel totals for ${periodLabel(year, month)}`
            : "Travel totals"
        }
      >
        <span className="tt-main">
          <strong>{totals.trips}</strong> {totals.trips === 1 ? "trip" : "trips"}
        </span>
        <span className="tt-sep" aria-hidden />
        <span className="tt-main">
          <strong>{formatKm(totals.totalKm)}</strong> travelled
        </span>
        {totals.byMode.length > 0 && (
          <span className="tt-modes">
            {totals.byMode.map((m) => (
              <span className="tt-mode" key={m.mode} title={`${m.trips} by ${m.mode}`}>
                {MODE_GLYPH[m.mode]} {m.trips}
              </span>
            ))}
          </span>
        )}
      </div>

      {!editingId && (
        <BoardingPassImport open={passOpen} onOpenChange={setPassOpen} onResult={handleScan} />
      )}

      <TripForm
        key={formKey}
        initial={draft}
        editing={!!editingId}
        onSave={(fields) => void saveTrip(fields)}
        onCancel={resetForm}
      />

      {trips.length === 0 ? (
        <p className="muted empty">
          <span className="empty-emoji" aria-hidden>
            🧭
          </span>
          No journeys logged yet. Add one you've taken — or scan a boarding pass and it fills itself
          in.
        </p>
      ) : sorted.length === 0 ? (
        <p className="muted empty">
          No trips in {periodLabel(year, month)}.{" "}
          <button className="link" type="button" onClick={() => pickYear("all")}>
            Show all
          </button>
        </p>
      ) : (
        <ul className="city-list" style={{ marginTop: 12 }}>
          {sorted.map((t) => {
            const km = tripDistanceKm(t, ref);
            const label = `${endpointLabel(t.from)} → ${endpointLabel(t.to)}`;
            return (
              <li key={t.tripId} className={"city-row compact" + (editingId === t.tripId ? " selected" : "")}>
                <button
                  className="city-focus"
                  type="button"
                  title={`Edit ${label}`}
                  onClick={() => startEdit(t)}
                >
                  <CityLine
                    flag={MODE_GLYPH[t.mode]}
                    name={label}
                    sub={
                      <>
                        {km == null ? "" : `· ${formatKm(km)}`}
                        {t.date ? ` · ${formatDate(t.date)}` : ""}
                        {t.note ? ` · ${t.note}` : ""}
                      </>
                    }
                  />
                </button>
                <button
                  className="link"
                  type="button"
                  onClick={() => startEdit(t)}
                  aria-label={`Edit trip ${label}`}
                >
                  Edit
                </button>
                <button
                  className="link-danger"
                  type="button"
                  onClick={() => removeWithUndo(t.tripId, label)}
                  aria-label={`Remove trip ${label}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
