import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { countryAtPoint } from "../../lib/reference/countryAtPoint";
import { useVisits } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { sanitizeText } from "../../lib/schema/sanitize";
import { useT } from "../../lib/i18n";

/**
 * Create a place the datasets don't know (a hamlet, a viewpoint, grandma's
 * village). This is YOUR data, not reference data — it lives only in your file,
 * clearly marked "your own place" (Constitution I: the app never invents
 * reference facts; users may record their own).
 */
export function AddPlaceForm({
  initialName,
  initialCoords,
  initialCountry,
  onDone,
}: {
  initialName: string;
  /** Prefill the coordinates (e.g. from a map long-press) so nothing is typed. */
  initialCoords?: { lat: number; lon: number };
  /** Prefill the country select. */
  initialCountry?: string;
  onDone: () => void;
}) {
  const t = useT();
  const ref = useMemo(() => getReferenceData(), []);
  const addVisit = useVisits((s) => s.addVisit);
  const [name, setName] = useState(initialName);
  const [cc, setCc] = useState(initialCountry ?? "");
  // Once you pick a country by hand we stop auto-filling it; until then a valid
  // coordinate (typed, or dropped on the map) resolves the country for you — the
  // point of "add a place" is naming the spot, not hunting for its country.
  const [ccTouched, setCcTouched] = useState(!!initialCountry);
  const [coords, setCoords] = useState(
    initialCoords ? `${initialCoords.lat.toFixed(5)}, ${initialCoords.lon.toFixed(5)}` : "",
  );

  const parsed = useMemo(() => {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(coords);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null;
  }, [coords]);

  // The country of the nearest gazetteer city to the entered point (offline).
  const autoCc = useMemo(
    () => (parsed ? countryAtPoint(ref.allCities(), parsed.lat, parsed.lon) : null),
    [parsed, ref],
  );
  useEffect(() => {
    if (autoCc && !ccTouched) setCc(autoCc);
  }, [autoCc, ccTouched]);

  // Sanitize like the portable-file schema will — a name that collapses to
  // empty (e.g. "===") must not be savable, or the export wouldn't restore.
  const cleanName = sanitizeText(name, 200);
  const canSave = cleanName.length > 0 && !!cc && (coords.trim() === "" || !!parsed);

  async function save() {
    const id = `custom-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`;
    await addVisit({
      place: {
        kind: "custom",
        id,
        name: cleanName,
        countryId: cc,
        ...(parsed ?? {}),
      },
    });
    if (parsed) useUi.getState().flyTo(parsed.lon, parsed.lat);
    onDone();
  }

  // Keyboard-first: Enter anywhere saves (once the form is valid), Escape cancels.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && canSave) {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.stopPropagation(); // cancel the form only — don't also navigate back
      onDone();
    }
  }

  return (
    <div className="add-place" onKeyDown={onKeyDown}>
      <p className="muted small">
        {t("addPlace.descPre")}
        <em>{t("addPlace.descEm")}</em>
        {t("addPlace.descPost")}
      </p>
      <div className="add-place-row">
        <input
          className="search-input"
          type="text"
          value={name}
          maxLength={200}
          placeholder={t("addPlace.namePlaceholder")}
          aria-label={t("addPlace.namePlaceholder")}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="select"
          value={cc}
          aria-label={t("addPlace.country")}
          onChange={(e) => {
            setCcTouched(true);
            setCc(e.target.value);
          }}
        >
          <option value="">{t("addPlace.countryOption")}</option>
          <option value="ZZ">🌊 {t("addPlace.noCountry")}</option>
          {ref.countries.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="add-place-row">
        <input
          className="search-input"
          type="text"
          value={coords}
          placeholder={t("addPlace.coordsPlaceholder")}
          aria-label={t("addPlace.coordsAria")}
          onChange={(e) => setCoords(e.target.value)}
        />
        <button className="btn" type="button" disabled={!canSave} onClick={() => void save()}>
          {t("addPlace.addButton")}
        </button>
      </div>
      {coords.trim() !== "" && !parsed && (
        <p className="muted small">{t("addPlace.coordsHint")}</p>
      )}
    </div>
  );
}
