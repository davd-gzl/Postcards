import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useTrips } from "../../lib/store/useTrips";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { countryFlag, formatDate, formatKm } from "../../lib/format/format";
import type { PlaceRef, TravelMode, Trip } from "../../lib/schema/models";
import { julianToDate, type BcbpResult } from "../../lib/bcbp/parse";
import { CityLine } from "../../ui/CityLine";
import { ListPager } from "../../ui/ListPager";
import { PlacePicker } from "./PlacePicker";
import { BoardingPassImport } from "./BoardingPassImport";
import { airportVisitCounts } from "./airports";
import { travelTotals, tripDistanceKm } from "./distance";
import { MODE_GLYPH, MODE_ORDER } from "./modes";
import {
  MONTH_NAMES,
  periodLabel,
  tripMonths,
  tripYears,
  tripsInPeriod,
  type MonthFilter,
  type YearFilter,
} from "./period";
import { useT, type MessageKey } from "../../lib/i18n";

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
  /** Optional folder label that groups legs of the same journey (e.g. "Japan 2024"). */
  name: string;
}

const EMPTY_FIELDS: TripFields = { from: null, to: null, mode: "flight", date: "", note: "", name: "" };

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
  const t = useT();
  const [from, setFrom] = useState<PlaceRef | null>(initial.from);
  const [to, setTo] = useState<PlaceRef | null>(initial.to);
  const [mode, setMode] = useState<TravelMode>(initial.mode);
  const [date, setDate] = useState(initial.date);
  const [note, setNote] = useState(initial.note);
  const [name, setName] = useState(initial.name);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    onSave({ from, to, mode, date, note, name });
  }

  return (
    <form className="trip-form" onSubmit={onSubmit}>
      {editing && <p className="editing-note">{t("travel.editingNote")}</p>}
      <label className="picker-label" htmlFor="trip-name">
        {t("travel.nameOptional")}
        <input
          id="trip-name"
          className="select"
          type="text"
          maxLength={80}
          placeholder={t("travel.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <PlacePicker label={t("travel.from")} value={from} onPick={setFrom} />
      <PlacePicker label={t("travel.to")} value={to} onPick={setTo} />
      <div className="trip-form-row">
        <label className="picker-label" htmlFor="trip-mode">
          {t("travel.modeLabel")}
          <select
            id="trip-mode"
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value as TravelMode)}
          >
            {MODE_ORDER.map((value) => (
              <option key={value} value={value}>
                {MODE_GLYPH[value]} {t(`travel.mode.${value}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="picker-label" htmlFor="trip-date">
          {t("travel.dateOptional")}
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
        {t("travel.noteOptional")}
        <input
          id="trip-note"
          className="select"
          type="text"
          maxLength={120}
          placeholder={t("travel.notePlaceholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="trip-form-actions">
        <button className="btn" type="submit" disabled={!from || !to}>
          {editing ? t("travel.saveChanges") : t("travel.addTrip")}
        </button>
        {editing && (
          <button className="btn-ghost" type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}

/** Log of journeys you've taken: add a trip, see per-trip distance and totals. */
export function TravelScreen() {
  const t = useT();
  const ref = useMemo(() => getReferenceData(), []);
  const trips = useTrips((s) => s.trips);
  const visits = useVisits((s) => s.visits);
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
  const flyTo = useUi((s) => s.flyTo);

  const years = useMemo(() => tripYears(trips), [trips]);
  const months = useMemo(() => (year === "all" ? [] : tripMonths(trips, year)), [trips, year]);
  const filtered = useMemo(() => tripsInPeriod(trips, year, month), [trips, year, month]);

  const totals = useMemo(() => travelTotals(filtered, ref), [filtered, ref]);
  // A lifetime "busiest airports" roll-up (every trip endpoint + any airport you
  // marked visited), most-visited first — independent of the year/month filter,
  // which scopes the editable trip list above, not this career summary.
  const airportCounts = useMemo(() => airportVisitCounts(trips, visits, ref), [trips, visits, ref]);
  const [shownAir, setShownAir] = useState(20);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [filtered],
  );

  // Group legs into folders by their trip name (keeping the newest-first order
  // within each folder). Named folders appear first, in order of their newest
  // leg; anything without a name falls into a final "unfiled" bucket. When no
  // trip carries a name we skip headers entirely and render one flat list.
  const groups = useMemo(() => {
    const named = new Map<string, Trip[]>();
    const unfiled: Trip[] = [];
    for (const trip of sorted) {
      const nm = trip.name?.trim();
      if (nm) {
        const list = named.get(nm);
        if (list) list.push(trip);
        else named.set(nm, [trip]);
      } else {
        unfiled.push(trip);
      }
    }
    return { named: [...named.entries()], unfiled, hasNames: named.size > 0 };
  }, [sorted]);

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
      { from: t.from, to: t.to, mode: t.mode, date: t.date ?? "", note: t.note ?? "", name: t.name ?? "" },
      t.tripId,
    );
    document.querySelector(".trip-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveTrip({ from, to, mode, date, note, name }: TripFields) {
    if (!from || !to) return;
    const prev = useTrips.getState().trips;
    // `name` is stamped like the other fields; an emptied label clears the folder.
    const fields = { from, to, mode, date: date || null, note: note.trim() || null, name: name.trim() || undefined };
    if (editingId) {
      await updateTrip(editingId, fields);
      showToast(t("travel.toast.updated", { from: endpointLabel(from), to: endpointLabel(to) }), () => setAll(prev));
    } else {
      await addTrip(fields);
      showToast(t("travel.toast.added", { from: endpointLabel(from), to: endpointLabel(to) }), () => setAll(prev));
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
    showToast(t("travel.toast.removed", { label }), () => setAll(prev));
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
        name: "",
      });
      const missing = [!leg.from && leg.codes[0], !leg.to && leg.codes[1]].filter(Boolean);
      showToast(
        missing.length
          ? t("travel.toast.scanReadMissing", {
              from: leg.codes[0],
              to: leg.codes[1],
              missing: missing.join(", "),
            })
          : t("travel.toast.scanReadOk", { from: leg.codes[0], to: leg.codes[1] }),
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
      t("travel.toast.scanAdded", {
        count: added,
        skipped: skipped.length ? t("travel.toast.scanSkipped", { list: skipped.join(", ") }) : "",
      }),
      () => setAll(prev),
    );
  }

  /** One trip row — shared by the flat list and the per-folder lists. */
  function renderTripRow(trip: Trip) {
    const km = tripDistanceKm(trip, ref);
    const label = `${endpointLabel(trip.from)} → ${endpointLabel(trip.to)}`;
    return (
      <li
        key={trip.tripId}
        className={"city-row compact" + (editingId === trip.tripId ? " selected" : "")}
      >
        <button
          className="city-focus"
          type="button"
          title={t("travel.editTitle", { label })}
          onClick={() => startEdit(trip)}
        >
          <CityLine
            flag={MODE_GLYPH[trip.mode]}
            name={label}
            sub={
              <>
                {km == null ? "" : `· ${formatKm(km)}`}
                {trip.date ? ` · ${formatDate(trip.date)}` : ""}
                {trip.note ? ` · ${trip.note}` : ""}
              </>
            }
          />
        </button>
        <button
          className="link"
          type="button"
          onClick={() => startEdit(trip)}
          aria-label={t("travel.editAria", { label })}
        >
          {t("common.edit")}
        </button>
        <button
          className="link-danger"
          type="button"
          onClick={() => removeWithUndo(trip.tripId, label)}
          aria-label={t("travel.removeAria", { label })}
        >
          {t("common.remove")}
        </button>
      </li>
    );
  }

  return (
    <section aria-label={t("travel.title")} onKeyDown={onEscape}>
      <div className="section-head">
        <h2>{t("travel.title")}</h2>
      </div>

      {years.length > 0 && (
        <div className="travel-filter trip-form-row" role="group" aria-label={t("travel.filterAria")}>
          <label className="picker-label" htmlFor="trip-filter-year">
            {t("travel.year")}
            <select
              id="trip-filter-year"
              className="select"
              value={year}
              onChange={(e) => pickYear(e.target.value as YearFilter)}
            >
              <option value="all">{t("travel.allYears")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          {year !== "all" && months.length > 0 && (
            <label className="picker-label" htmlFor="trip-filter-month">
              {t("travel.month")}
              <select
                id="trip-filter-month"
                className="select"
                value={month}
                onChange={(e) => pickMonth(e.target.value as MonthFilter)}
              >
                <option value="all">{t("travel.allMonths")}</option>
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
            ? t("travel.totalsForAria", { period: periodLabel(year, month) })
            : t("travel.totalsAria")
        }
      >
        <span className="tt-main">
          <strong>{totals.trips}</strong> {t.plural("stats.travel.trips", totals.trips)}
        </span>
        <span className="tt-sep" aria-hidden />
        <span className="tt-main">
          <strong>{formatKm(totals.totalKm)}</strong> {t("stats.travel.travelled")}
        </span>
        {totals.byMode.length > 0 && (
          <span className="tt-modes">
            {totals.byMode.map((m) => (
              <span
                className="tt-mode"
                key={m.mode}
                title={t("stats.travel.modeTitle", {
                  count: m.trips,
                  mode: t(`travel.mode.${m.mode}` as MessageKey),
                })}
              >
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
          {t("travel.empty")}
        </p>
      ) : sorted.length === 0 ? (
        <p className="muted empty">
          {t("travel.noTripsInPeriod", { period: periodLabel(year, month) })}{" "}
          <button className="link" type="button" onClick={() => pickYear("all")}>
            {t("travel.showAll")}
          </button>
        </p>
      ) : !groups.hasNames ? (
        <ul className="city-list" style={{ marginTop: 12 }}>
          {sorted.map((trip) => renderTripRow(trip))}
        </ul>
      ) : (
        <div className="trip-folders" style={{ marginTop: 12 }}>
          {groups.named.map(([folder, list]) => (
            <section className="trip-folder" key={`f:${folder}`} aria-label={folder}>
              <h3 className="trip-folder-name">
                <span aria-hidden>🗂️</span> {folder}{" "}
                <span className="muted small">({list.length})</span>
              </h3>
              <ul className="city-list">{list.map((trip) => renderTripRow(trip))}</ul>
            </section>
          ))}
          {groups.unfiled.length > 0 && (
            <section className="trip-folder" aria-label={t("travel.folderUnfiled")}>
              <h3 className="trip-folder-name">{t("travel.folderUnfiled")}</h3>
              <ul className="city-list">{groups.unfiled.map((trip) => renderTripRow(trip))}</ul>
            </section>
          )}
        </div>
      )}

      {airportCounts.length > 0 && (
        <section className="airport-rollup" aria-label={t("travel.airports.aria")}>
          <h3 className="trip-folder-name">
            <span aria-hidden>✈️</span> {t("travel.airports.title")}{" "}
            <span className="muted small">({airportCounts.length})</span>
          </h3>
          <ul className="city-list">
            {airportCounts.slice(0, shownAir).map(({ airport, count }) => {
              const country = ref.countryByIso2(airport.countryIso2)?.name ?? airport.countryIso2;
              const label = t.plural("travel.airports.count", count);
              return (
                <li key={airport.id} className="city-row compact dense">
                  <button
                    className="city-focus"
                    type="button"
                    title={t("travel.airports.focusAria", { name: airport.name })}
                    onClick={() => flyTo(airport.lon, airport.lat)}
                  >
                    <CityLine
                      flag={countryFlag(airport.countryIso2)}
                      name={
                        <>
                          <strong>{airport.id}</strong> {airport.name}
                        </>
                      }
                      title={`${airport.id} · ${airport.name}`}
                      sub={<>· {airport.city || country}</>}
                    />
                  </button>
                  <span className="airport-count" title={label} aria-label={label}>
                    ✈ {count}
                  </span>
                </li>
              );
            })}
          </ul>
          {airportCounts.length > shownAir && (
            <ListPager
              shown={shownAir}
              total={airportCounts.length}
              step={20}
              onMore={() => setShownAir((n) => n + 20)}
            />
          )}
        </section>
      )}
    </section>
  );
}
