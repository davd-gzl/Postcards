import { useMemo } from "react";
import { getReferenceData } from "../lib/reference/referenceData";

/** Surfaces reference-dataset provenance (Constitution I & Data Standards). */
export function Attribution() {
  const ref = useMemo(() => getReferenceData(), []);
  return (
    <div className="attribution">
      <strong>Data sources:</strong>{" "}
      {ref.provenance.map((p, i) => (
        <span key={p.dataset}>
          {i > 0 ? " · " : ""}
          {p.dataset} ({p.license})
        </span>
      ))}
    </div>
  );
}
