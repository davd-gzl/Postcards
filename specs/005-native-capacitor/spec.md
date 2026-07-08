# Feature Specification: Native iOS/Android packaging (Capacitor)

**Feature Directory**: `specs/005-native-capacitor`

**Created**: 2026-07-05

**Status**: Draft

**Input**: Maintainer request: "Ship to a real phone." Wrap the existing web build as native
iOS/Android apps via Capacitor (Constitution: one codebase → PWA + native iOS/Android).

## Clarifications

### Session 2026-07-05

- Q: Rewrite for native? → A: **No.** Capacitor wraps the same `dist/` web build in a native shell.
  One codebase; the PWA remains the source of truth.
- Q: Are signed binaries produced here? → A: **No.** This Linux CI container has no Android SDK and
  iOS needs macOS + Xcode. This increment ships the **scaffolding + docs**; binaries are built on
  the maintainer's machine.
- Q: Commit the native projects? → A: Commit the **Android** project (it scaffolds on Linux, build
  outputs git-ignored). iOS is generated on macOS (`cap add ios`) and committed there.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build and run on a device (Priority: P1)

A developer with Android Studio (or Xcode on macOS) can build and run Postcards on a real phone
from the committed Capacitor setup, with the same offline-first behavior as the PWA.

**Independent Test**: `pnpm build && pnpm cap:sync && pnpm cap:open:android` opens the project in
Android Studio ready to Run; the app loads the bundled web build offline.

**Acceptance Scenarios**:

1. **Given** the committed `capacitor.config.ts` + `android/` project, **When** the developer syncs
   and opens Android Studio, **Then** the web build loads in the native shell.
2. **Given** a Mac, **When** the developer runs `pnpm cap:add:ios` then `cap:open:ios`, **Then** an
   Xcode project is generated and runnable after setting a signing team.
3. **Given** the native shell with no network, **When** the app launches, **Then** the map + all
   reference data work offline (as in the PWA).

## Requirements *(mandatory)*

- **FR-050**: The native apps MUST wrap the same web build (`webDir: dist`); no separate native
  UI codebase.
- **FR-051**: The repo MUST include a working Capacitor setup (config, deps, npm scripts) and the
  committed Android project; iOS is a documented one-command add on macOS.
- **FR-052**: The native build MUST preserve offline-first behavior and add no telemetry.
- **FR-053**: Build steps for both platforms MUST be documented (`docs/NATIVE-BUILDS.md`).

## Success Criteria *(mandatory)*

- **SC-001**: From a clean checkout, `pnpm build && pnpm cap:sync` prepares the Android project
  without errors on a machine with the Android SDK.
- **SC-002**: The committed Android project excludes all build artifacts (only source tracked).
- **SC-003**: The web/PWA build and all existing tests are unaffected.

## Out of Scope (this increment)

- Producing signed `.apk`/`.ipa` binaries or store submission (needs SDK/Xcode + signing).
- Native plugin wiring (Filesystem/Share for native file export; the shared Offline Map Store
  plugin) — documented integration points, built when going fully native.
- App store assets (screenshots, listings, privacy nutrition labels).
