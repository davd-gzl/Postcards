import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useTrips } from "../../lib/store/useTrips";
import { useToast } from "../../lib/store/useToast";
import { formatDate, formatKm } from "../../lib/format/format";
import type { PlaceRef, TravelMode, Trip } from "../../lib/schema/models";
import { julianToDate, type BcbpResult } from "../../lib/bcbp/parse";
import { PlacePicker } from "./PlacePicker";
import { BoardingPassImport } from "./BoardingPassImport";
import { travelTotals, tripDistanceKm } from "./distance";

const MODES: { value: TravelMode; label: string; glyph: string }[] = [
  { value: "flight", label: "Flight", glyph: "✈️" },
  { value: "train", label: "Train", glyph: "🚆" },
  { value: "bus", label: "Bus", glyph: "🚌" },
  { value: "ferry", label: "Ferry", glyph: "⛴️" },
  { value: "car", label: "Car", glyph: "🚗" },
  { value: "other", label: "Other", glyph: "•" },
];
const GLYPH: Record<TravelMode, string> = Object.fromEntries(
  MODES.map((m) => [m.value, m.glyph]),
) as Record<TravelMode, string>;

/** Compact endpoint label: the IATA code for airports (names are long), else the place name. */
function endpointLabel(p: PlaceRef): string {
  return p.kind === "airport" ? p.id : p.name;
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

  const [from, setFrom] = useState<PlaceRef | null>(null);
  const [to, setTo] = useState<PlaceRef | null>(null);
  const [mode, setMode] = useState<TravelMode>("flight");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const totals = useMemo(() => travelTotals(trips, ref), [trips, ref]);
  const sorted = useMemo(
    () => [...trips].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [trips],
  );

  function resetForm() {
    setFrom(null);
    setTo(null);
    setMode("flight");
    setDate("");
    setNote("");
    setEditingId(null);
  }

  function startEdit(t: Trip) {
    setFrom(t.from);
    setTo(t.to);
    setMode(t.mode);
    setDate(t.date ?? "");
    setNote(t.note ?? "");
    setEditingId(t.tripId);
    document.querySelector(".trip-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      setMode("flight");
      // Always replace both endpoints — clear an unresolved code so the field the
      // toast asks the user to fill is actually empty (never a stale leftover).
      setFrom(leg.from ?? null);
      setTo(leg.to ?? null);
      setDate(leg.date);
      setNote(leg.flight ? `Flight ${leg.flight}` : "");
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
    <section aria-label="Travel log">
      <div className="section-head">
        <h2>Travel log</h2>
      </div>

      <div className="travel-totals" aria-label="Travel totals">
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
                {GLYPH[m.mode]} {m.trips}
              </span>
            ))}
          </span>
        )}
      </div>

      {!editingId && <BoardingPassImport onResult={handleScan} />}

      <form className="trip-form" onSubmit={onSubmit}>
        {editingId && <p className="editing-note">Editing a trip</p>}
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
                  {m.glyph} {m.label}
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
            {editingId ? "Save changes" : "Add trip"}
          </button>
          {editingId && (
            <button className="btn-ghost" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {trips.length === 0 ? (
        <p className="muted empty">
          <span className="empty-emoji" aria-hidden>
            🧭
          </span>
          No journeys logged yet. Add one you've taken — or scan a boarding pass and it fills itself
          in.
        </p>
      ) : (
        <ul className="city-list" style={{ marginTop: 12 }}>
          {sorted.map((t) => {
            const km = tripDistanceKm(t, ref);
            const label = `${endpointLabel(t.from)} → ${endpointLabel(t.to)}`;
            return (
              <li key={t.tripId} className={"city-row compact" + (editingId === t.tripId ? " selected" : "")}>
                <div className="city-focus" style={{ cursor: "default" }}>
                  <span className="city-line">
                    <span className="flag" aria-hidden>
                      {GLYPH[t.mode]}
                    </span>
                    <span className="city-name">{label}</span>
                    <span className="city-sub">
                      {km == null ? "" : `· ${formatKm(km)}`}
                      {t.date ? ` · ${formatDate(t.date)}` : ""}
                      {t.note ? ` · ${t.note}` : ""}
                    </span>
                  </span>
                </div>
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
