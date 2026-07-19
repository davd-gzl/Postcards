// Reusable, framework-agnostic Wikivoyage seam.
//
// Postcards is one member of a wider ecosystem; this module is written to be
// lifted wholesale into a shared library later, so it takes PLAIN inputs and has
// NO dependency on the app's stores, reference data, or React. It is an
// aggregator over Wikivoyage (CC BY-SA): it only builds links and, on explicit
// opt-in, fetches article summaries — it never authors travel content, degrades
// gracefully offline, and sends no telemetry (Constitution II/III/IX).

/** A spoken language of a place, used to build phrasebook / alphabet links. */
export interface WikivoyageLanguage {
  /** Language code (e.g. ISO 639-3 "fra"). Opaque here — only `name` is used. */
  code: string;
  /** English language name as Wikivoyage titles it, e.g. "French", "Japanese". */
  name: string;
}

/** The place a guide is built for. Only names are needed — nothing app-specific. */
export interface WikivoyagePlaceInput {
  /** City/town name, when the guide is for a city (omit for a country-only guide). */
  cityName?: string;
  /** Country display name = its Wikivoyage article title, e.g. "France". */
  countryName: string;
  /** ISO 3166-1 alpha-2 — used only to mint stable link ids. */
  countryIso2: string;
  /** Spoken languages, for phrasebook & alphabet links. */
  languages?: WikivoyageLanguage[];
}

export type WikivoyageGuideKind =
  | "place" // the city/town travel guide
  | "country" // the country travel guide
  | "understand" // the country "Understand" section (geography, history, culture…)
  | "phrasebook"; // "<Language> phrasebook" (phrases + the alphabet/pronunciation)

export interface WikivoyageLink {
  /** Stable id, unique within one place's guide list. */
  id: string;
  kind: WikivoyageGuideKind;
  /** The human name this link is about (city / country / language). The display
   *  label + hint are derived from `kind` + `name` at render time, so this stays a
   *  language-independent link builder (the UI localizes; see GuideContent). */
  name: string;
  /** Wikivoyage article title (unencoded), e.g. "Paris", "French phrasebook". */
  title: string;
  /** Ready-to-open URL (may include a section anchor). */
  url: string;
}

/** An opt-in, online-fetched article summary (plain text — inert). */
export interface WikivoyageSummary {
  title: string;
  extract: string;
  url: string;
  attribution: string;
  /** Lead-image URL (upload.wikimedia.org), when the page has one. */
  thumb?: string;
}
