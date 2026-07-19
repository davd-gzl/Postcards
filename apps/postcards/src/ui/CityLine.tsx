import type { ReactNode } from "react";

/** The standard list-row line: flag (or glyph) · place name · optional detail.
 *  The name is clipped with an ellipsis when the row is narrow; a `title` on the
 *  name span restores the mouse-hover reveal of the full text (screen readers
 *  already get it from the DOM). Auto-derived from a plain-string name, so most
 *  call sites need no change.
 *
 *  `multiline` — for rows whose names are intrinsically long (monuments,
 *  airports): the name WRAPS to a second line instead of truncating, and the
 *  detail drops below it, so a name like "Historic Sanctuary of Machu Picchu" is
 *  never cut to "Historic Sanctuary of Ma…". Cities keep the one-line dense look. */
export function CityLine({
  flag,
  name,
  sub,
  title,
  multiline = false,
}: {
  flag: ReactNode;
  name: ReactNode;
  sub?: ReactNode;
  title?: string;
  multiline?: boolean;
}) {
  const nameTitle = title ?? (typeof name === "string" ? name : undefined);
  return (
    <span className={"city-line" + (multiline ? " multiline" : "")}>
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
