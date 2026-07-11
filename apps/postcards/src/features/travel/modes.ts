import type { TravelMode } from "../../lib/schema/models";

/** Emoji per travel mode — the single source for the Travel log and Stats. */
export const MODE_GLYPH: Record<TravelMode, string> = {
  flight: "✈️",
  train: "🚆",
  bus: "🚌",
  ferry: "⛴️",
  car: "🚗",
  other: "•",
};
