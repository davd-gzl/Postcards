# Interaction Contracts

The app's "interfaces" are its interactions. These are the observable behaviors each theme
must satisfy — testable via Playwright + screenshots. Format: **Given → When → Then**, tied
to FR/SC ids.

## C1 — Single egress gate (FR-001..005, SC-001)

- Given Offline mode ON → When any surface (map, place, guide, packs, publish preview,
  onboarding) renders or is interacted with → Then **zero** optional network requests are
  issued (assert via request interception in e2e).
- Given the Map → When controls are inspected → Then there is **no** per-map "detailed map"
  toggle; the online basemap is driven only by the global mode.
- Given the top-bar chip → When clicked → Then the global mode flips and every surface
  reflects it immediately (label/dot + behavior).
- Given Settings → When opened → Then all online-related controls appear in one grouped
  section, each with a title/aria label; those requiring online are disabled+explained when
  Offline.

## C2 — Durable data / long-term memory (FR-028..031, SC-010)

- Given the first real data write → When it occurs → Then the app calls the persistence
  request once and records the resulting state.
- Given persistence = denied/unknown and unsaved changes exist → When the user is on a
  relevant screen → Then a non-blocking warning + one-tap backup path is visible.
- Given a backup was taken → When it succeeds → Then `lastBackupAt` updates and the
  indicator shows a fresh state; a later data change flips it to "changed since backup."
- Given a reset/reinstall + a backup file → When the user restores → Then all places, trips,
  journal, photos, and settings return (assert count + spot-check content).

## C3 — Show-a-friend navigation (FR-006..010, SC-002/003)

- Given a cold open → When the user taps one control for Favorites / Wishlist /
  Monuments-near-me / a specific Trip → Then that pre-filtered view shows with no extra step.
- Given any place list or search result → When a place is tapped → Then the map flies to it
  **and** its list row becomes selected/scrolled-into-view (both, every time).
- Given any place list → When rendered → Then a search bar is present and filters as typed.
- Given visited places → When sort/filter is applied → Then trip, folder, date, favorite,
  country, and place type are all available and composable.
- Given a long-ago place → When searched and marked visited → Then it is logged with no
  forced "current trip" step.

## C4 — Journal (FR-011..013, SC-004)

- Given the Journal → When opened → Then **no** empty composer occupies the page; one clear
  primary control opens it in one tap (a recovered draft still reopens).
- Given entries → When searched/sorted/filtered → Then by city, trip, folder, and date.
- Given Offline → When an entry with photos is saved → Then it persists locally with no
  network.

## C5 — Onboarding (FR-019/020, SC-008)

- Given first launch → When the intro shows → Then it presents the online/offline choice and
  optional downloads concisely (prose-light), each actionable or skippable.
- Given Offline chosen → When the intro adapts → Then online-only options de-emphasized.
- Given onboarding done/skipped → When the user looks later → Then the same controls live in
  Settings.

## C6 — Speed & mobile (FR-021/022, SC-007)

- Given the full gazetteer loaded → When pan/zoom/view-switch/place-tap/composer-open →
  Then no perceptible stall (measure on a throttled profile).
- Given a phone viewport → When a city detail opens → Then its photo is visible without
  scrolling (screenshot assert).

## Accessibility contract (all themes, FR-026)

- Every new interactive control: reachable by keyboard, visible focus, `title` (and
  `aria-label` when icon-only), correct roles/`aria-pressed` for toggles. axe-core clean.
