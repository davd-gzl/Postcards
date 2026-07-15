import type { ReactNode } from "react";

/** The standard list-row line: flag (or glyph) · place name · optional detail.
 *  The name is clipped with an ellipsis when the row is narrow; a `title` on the
 *  name span restores the mouse-hover reveal of the full text (screen readers
 *  already get it from the DOM). Auto-derived from a plain-string name, so most
 *  call sites need no change. */
export function CityLine({
  flag,
  name,
  sub,
  title,
}: {
  flag: ReactNode;
  name: ReactNode;
  sub?: ReactNode;
  title?: string;
}) {
  const nameTitle = title ?? (typeof name === "string" ? name : undefined);
  return (
    <span className="city-line">
      <span className="flag" aria-hidden>
        {flag}
      </span>
      <span className="city-name" title={nameTitle}>
        {name}
      </span>
      {sub != null && <span className="city-sub">{sub}</span>}
    </span>
  );
}
