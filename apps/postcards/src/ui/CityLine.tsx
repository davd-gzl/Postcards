import type { ReactNode } from "react";

/** The standard list-row line: flag (or glyph) · place name · optional detail. */
export function CityLine({ flag, name, sub }: { flag: ReactNode; name: ReactNode; sub?: ReactNode }) {
  return (
    <span className="city-line">
      <span className="flag" aria-hidden>
        {flag}
      </span>
      <span className="city-name">{name}</span>
      {sub != null && <span className="city-sub">{sub}</span>}
    </span>
  );
}
