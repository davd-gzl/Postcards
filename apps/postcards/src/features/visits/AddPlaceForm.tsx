import { useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { sanitizeText } from "../../lib/schema/sanitize";

/**
 * Create a place the datasets don't know (a hamlet, a viewpoint, grandma's
 * village). This is YOUR data, not reference data — it lives only in your file,
 * clearly marked "your own place" (Constitution I: the app never invents
 * reference facts; users may record their own).
 */
export function AddPlaceForm({ initialName, onDone }: { initialName: string; onDone: () => void }) {
  const ref = useMemo(() => getReferenceData(), []);
  const addVisit = useVisits((s) => s.addVisit);
  const [name, setName] = useState(initialName);
  const [cc, setCc] = useState("");
  const [coords, setCoords] = useState("");

  const parsed = useMemo(() => {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(coords);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null;
  }, [coords]);

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
        Add it yourself — saved as <em>your own place</em> in your file, shown on the map if you
        give coordinates.
      </p>
      <div className="add-place-row">
        <input
          className="search-input"
          type="text"
          value={name}
          maxLength={200}
          placeholder="Place name"
          aria-label="Place name"
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="select"
          value={cc}
          aria-label="Country"
          onChange={(e) => setCc(e.target.value)}
        >
          <option value="">Country…</option>
          <option value="ZZ">🌊 No country (open ocean, anywhere)</option>
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
          placeholder="Coordinates (lat, lon) — optional"
          aria-label="Coordinates, latitude comma longitude, optional"
          onChange={(e) => setCoords(e.target.value)}
        />
        <button className="btn" type="button" disabled={!canSave} onClick={() => void save()}>
          Add place
        </button>
      </div>
      {coords.trim() !== "" && !parsed && (
        <p className="muted small">Coordinates must look like “48.85, 2.35”.</p>
      )}
    </div>
  );
}
