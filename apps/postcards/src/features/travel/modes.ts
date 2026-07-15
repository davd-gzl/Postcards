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

/** Stable display order for travel modes (totals, the trip form). */
export const MODE_ORDER: TravelMode[] = ["flight", "train", "bus", "ferry", "car", "other"];

/** Human label per travel mode — used by the form and the Markdown export. */
export const MODE_LABEL: Record<TravelMode, string> = {
  flight: "Flight",
  train: "Train",
  bus: "Bus",
  ferry: "Ferry",
  car: "Car",
  other: "Other",
};
