# Feature Specification: Boarding-pass import (BCBP)

**Feature Directory**: `specs/006-boarding-pass`

**Created**: 2026-07-05

**Status**: Draft

**Input**: Maintainer request: "parse automatically a travel ticket, so you can show it on the map."
Read a boarding pass and turn it into a logged trip — entirely on-device.

## Clarifications

### Session 2026-07-05

- Q: What is parsed? → A: the **IATA BCBP** (Bar-Coded Boarding Pass, Res. 792) string encoded in
  the barcode on every boarding pass. Its mandatory fields include from/to airport (IATA), carrier,
  flight number, and flight date (Julian day-of-year).
- Q: How is it read? → A: two ways — **scan a photo** of the pass where the browser's
  `BarcodeDetector` supports PDF417/Aztec/QR, or **paste the code**. Both parse locally; the ticket
  is never uploaded (privacy by default; data is inert — parsed, never executed).
- Q: The year isn't on the pass — what date? → A: assume the most recent occurrence: this year,
  unless that lands in the future (then last year), since a scanned pass is for a trip taken.
- Q: Unknown airport code? → A: never invented — if a code isn't in the airports gazetteer, that
  endpoint is left for the user to pick (single leg) or the leg is skipped and reported (connection).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn a boarding pass into a trip (Priority: P1)

A traveler scans or pastes a boarding pass. The app reads the from/to airports and date and either
prefills the trip form (one leg) for review, or logs every leg of a connection as a flight — which
then appears on the map as an arc.

**Independent Test**: Paste a valid BCBP string; confirm the form is prefilled with the two airports
and the flight date, and saving logs the flight.

**Acceptance Scenarios**:

1. **Given** a valid single-leg BCBP, **When** it is read, **Then** the trip form is prefilled with
   the departure/arrival airports (resolved from the gazetteer), mode = flight, and the flight date.
2. **Given** a multi-leg (connection) BCBP, **When** it is read, **Then** each fully-resolved leg is
   logged as a flight with a single undo.
3. **Given** a photo of a pass on a device whose `BarcodeDetector` supports the barcode, **When** the
   user picks it, **Then** the code is decoded and handled as above; where unsupported, paste works.
4. **Given** input that isn't a boarding pass, **When** read, **Then** it's rejected with a clear
   message and no trip is created.

## Requirements *(mandatory)*

- **FR-060**: The app MUST parse an IATA BCBP string into its legs (from, to, carrier, flight,
  Julian date) entirely on-device; the pass MUST NOT be uploaded anywhere.
- **FR-061**: A Julian day-of-year MUST resolve to a date assuming the most recent past occurrence.
- **FR-062**: Airport codes MUST be resolved against the reference gazetteer; unresolved codes are
  never invented — the endpoint is left to the user (single leg) or the leg is skipped and reported.
- **FR-063**: Reading MUST support pasting the code, and scanning a photo where the browser's
  `BarcodeDetector` supports PDF417/Aztec/QR (feature-detected, graceful paste-only fallback).
- **FR-064**: Non-boarding-pass input MUST be rejected with a clear message and create no trip.

## Success Criteria *(mandatory)*

- **SC-001**: A valid single-leg pass prefills the trip in ≤ 2 actions (open, read).
- **SC-002**: A connection logs one flight per resolvable leg; distances/arcs follow automatically.
- **SC-003**: Parsing makes no network request; the ticket never leaves the device.
- **SC-004**: All existing tests stay green; the parser is unit-tested against real BCBP strings.

## Out of Scope (this increment)

- Live camera-stream scanning UI (uses the still-photo path via `BarcodeDetector`); a native
  camera plugin can come with the Capacitor build.
- PKPASS / PDF / email-confirmation parsing.
- Seat/fare/passenger details — only the journey (from/to/date) is used.
