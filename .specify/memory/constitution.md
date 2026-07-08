<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 1.2.0
Bump rationale (1.2.0): Record the "format at rest vs. encoding in transit"
guardrail and the data-scaling strategy under Data & Dataset Standards
(MINOR — new guidance; no principle removed or redefined).
Prior (1.1.0): Recorded the multi-app ecosystem architecture and the
device-global, cross-app shared offline map store under Technology Constraints.
Prior (1.0.0): Initial ratification of the project constitution.

Modified principles: none (guidance added to Technology Constraints)
Added sections:
  - Core Principles I–VIII
  - Technology Constraints
  - Data & Dataset Standards
  - Development Workflow & Quality Gates
  - Governance
Removed sections: none

Templates requiring updates:
  - .specify/templates/plan-template.md ..... ✅ reviewed (Constitution Check gate is generic; principles map cleanly)
  - .specify/templates/spec-template.md ..... ✅ reviewed (no mandatory-section changes required)
  - .specify/templates/tasks-template.md .... ✅ reviewed (task categories compatible)
  - .claude/skills/*/SKILL.md ................ ✅ reviewed (agent-generic; no outdated references)

Follow-up TODOs: none
-->

# Postcards Constitution

A privacy-first, local-first aggregator for remembering the places you have been —
cities, countries, and (later) any place type — with rich statistics and portable,
shareable data. This constitution defines the non-negotiable principles that govern
every specification, plan, and implementation in this project.

## Core Principles

### I. Aggregator, Never an Author (NON-NEGOTIABLE)

The application aggregates, records, and displays existing facts about the world; it
MUST NOT invent, mint, or become the authoritative source of world data (place names,
boundaries, coordinates, populations, country lists, etc.).

- Reference data (geography, populations, UNESCO sites, etc.) MUST originate from a
  named, external, openly-licensed dataset with recorded provenance (source + version).
- When a needed dataset does not exist, it MUST be produced as a **separate, standalone,
  publicly shareable dataset** (e.g. its own repository or release artifact) — not
  hard-wired into the application code or bundled as an un-attributed blob.
- User-generated content is limited to the user's own records (what they visited, when,
  personal notes, ticket logs) — never fabricated reference facts.

Rationale: The value and trustworthiness of the tool depend on it being a faithful lens
over real, attributable data. Mixing authored data into the app destroys portability,
auditability, and community reuse.

### II. Local-First & Fully Decentralized

All core functionality MUST work with zero central server and zero network connection.

- No account, no login, no cloud backend is required to use any core feature.
- The user's device is the source of truth. Sync/backup is the user's choice of transport
  (a file, a drive, a git repo), never a mandated service.
- "Community" features (shared datasets, shared maps) MUST be implemented as decentralized
  artifacts (e.g. files, git repositories, static indexes) that the user opts into loading —
  not as calls to a project-operated backend.
- P2P or direct sharing MAY be used **only where it genuinely serves the user** (e.g.
  sharing a map with a friend); it MUST never become a hidden dependency for core use.

Rationale: The user asked for a tool they fully own and can run forever, offline, without
anyone's permission or infrastructure.

### III. Privacy by Default

The user's location history is among the most sensitive data a person holds and MUST be
treated accordingly.

- No telemetry, analytics, tracking, ads, or third-party beacons. Ever.
- Nothing about the user or their data leaves the device unless the user takes an explicit,
  informed action (an export, a share, a sync they configured).
- Any future optional network feature MUST be off by default, clearly labeled, and fully
  functional to decline.

Rationale: Privacy is a stated core value; a location-memory tool that leaks is worse
than useless.

### IV. One Portable, Human-Readable Data File

All of a user's data MUST live in a single portable file they can read, diff, back up,
and move anywhere.

- Canonical source of truth: a single, human-readable, git-diffable **JSON** document.
- The app MUST support full **export and re-import** of this file with no loss.
- A **Markdown** export MUST be provided for human sharing (e.g. sending a map to a friend).
- The data format MUST be documented with an explicit, versioned schema and MUST NOT
  depend on the application to be understood.

Rationale: Data outlives apps. A single, legible, portable file is the guarantee of
ownership, backup, and longevity.

### V. Zero Lock-In — No Proprietary or Cloud Dependencies

The project MUST NOT depend on Google, proprietary SaaS, paid APIs, or closed data to
deliver any core feature.

- Maps, geocoding, and reference data MUST use open, self-hostable components and
  openly-licensed datasets.
- Every runtime dependency for a core feature MUST be free, open source, and replaceable.
- Optional third-party integrations (e.g. Wikivoyage, an external AI helper) MUST degrade
  gracefully: the app remains fully usable when they are absent or unreachable.

Rationale: "No dependency (Google, whatever)" — independence is a first-class requirement,
not a nice-to-have.

### VI. Security by Design — Data Is Inert

Data files (own or community-sourced) MUST be treated as untrusted, inert content.

- Data MUST NEVER contain or trigger executable code, commands, scripts, formulas, or
  templating. Importers MUST parse data only, never evaluate it.
- All imported data (especially community datasets) MUST be schema-validated and sanitized
  before use; malformed or unexpected fields are rejected, not executed.
- No dynamic code execution (`eval`, remote code, arbitrary URL fetch triggered by data)
  may be driven by file contents.

Rationale: A shareable-data tool is an attack surface. Keeping data strictly inert is the
single most important defense.

### VII. Efficient, Accessible, Keyboard-First UX

The interface MUST be fast, keyboard-driven, accessible, and free of clutter ("no BS").

- Common actions (record a visit, search, view stats) MUST be reachable quickly, with
  keyboard shortcuts for power users.
- The app MUST meet recognized accessibility standards (target WCAG 2.1 AA): full keyboard
  operability, screen-reader labels, sufficient contrast, respects reduced-motion.
- The UI MUST adapt sensibly to the region being viewed (naming, scripts, units) without
  assuming one locale.
- Performance is a feature: interactions on a typical dataset MUST feel instantaneous.

Rationale: The user explicitly prioritized speed, shortcuts, accessibility, and a
distraction-free experience.

### VIII. Interoperable & AI-Friendly

Data and exports MUST be trivially consumable by other tools and AI agents.

- Formats MUST be open, self-describing, and documented (JSON schema, Markdown).
- The data model MUST be stable and versioned so external tools and agents can read/write
  it reliably.
- AI or automation integrations operate **on the portable data through documented formats**
  and MUST obey all other principles (local-first, privacy, inert data, no lock-in).

Rationale: "AI compatible" and interoperability require legible, stable, open formats —
which the portable-file and aggregator principles already provide.

## Technology Constraints

These are the ratified defaults; deviations require justification in a plan's Complexity /
Constitution-Check section.

- **Architecture**: Web-first, single codebase. Ships as a self-hostable PWA (the website)
  and as native iOS/Android via a web-native wrapper (Capacitor). One codebase → phone + web.
- **Language/UI**: TypeScript + React.
- **Maps**: MapLibre GL with open tiles; offline single-file tiles (PMTiles) preferred. No
  Google Maps or other proprietary map SDKs.
- **Reference data**: openly-licensed datasets only (e.g. Natural Earth, GeoNames-class,
  Wikidata/Wikivoyage), each with recorded source + version.
- **Storage**: on-device (e.g. IndexedDB/OPFS) with the canonical JSON file as the portable
  export/import format; Markdown for human-shareable exports.
- **Backend**: none required for core features. Any optional sync is a user-chosen transport
  (file, drive, git), not a project-run server.
- **Ecosystem & shared offline maps**: This app is one member of a wider ecosystem of the
  user's Capacitor apps that share common resources. Offline map data (PMTiles) MUST be
  storable in a device-global, cross-app shared location — never locked to app-private
  storage — so any app in the ecosystem can reuse the same downloaded maps. Maps MUST be
  consumed through an abstract "map source" interface with platform-specific backing:
  a shared App Group container (iOS); a user-designated shared folder via the Storage
  Access Framework, or a content provider (Android); a shared filesystem directory
  (desktop); served/OPFS tiles (web). This shared "Offline Map Store" SHOULD be delivered
  as a reusable Capacitor plugin + SDK so the whole ecosystem depends on one component.
  No app may assume map data is confined to its own sandbox.

## Data & Dataset Standards

- Every reference dataset MUST declare: name, source URL, license, and version/date.
- Community-shared datasets are external artifacts (e.g. a git repo or release) that the
  user opts into loading; the app ships an index/loader, not the authoritative data.
- All data files MUST validate against a published, versioned schema before import.
- Schema changes MUST be versioned and backward-compatible where possible; migrations MUST
  be documented and preserve user data.
- Personal data and reference data MUST be cleanly separable so a user can back up their own
  records independently of bundled datasets.
- **Format at rest vs. encoding in transit**: The human-readable JSON is the canonical format at
  rest and for interchange and MUST remain readable and portable. Compact or binary encodings
  (e.g. CBOR/MessagePack) and CRDT deltas are transport concerns layered on top and MUST round-trip
  losslessly to/from the canonical JSON. Scaling to larger data MUST NOT abandon the readable
  interchange format: use an efficient internal working store, shard to newline-delimited JSON
  (NDJSON) for append/stream/diff, compress for transport, and sync via compact deltas over
  constrained or decentralized transports (e.g. LoRa, mesh). Bandwidth-limited links carry deltas,
  never whole files.

## Development Workflow & Quality Gates

- **Spec-Driven Development**: Every feature flows through the Spec Kit workflow —
  `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`. No implementation without an approved spec and plan.
- **Constitution Check**: Every plan MUST include a gate confirming alignment with these
  principles; any violation MUST be justified explicitly or the design revised.
- **Scope discipline**: Features that drift toward trip planning, social networks, or
  server-backed services are out of scope and MUST be rejected as scope creep. The mandate
  is: store data and display it well.
- **Testing**: Core logic (stats, import/export, schema validation, sanitization) MUST be
  covered by automated tests. Import/sanitization paths MUST have security-focused tests.
- **Open Source & Non-Commercial**: The project is open source for personal, non-commercial
  use. Licensing and contribution norms MUST reflect that intent.

## Governance

- This constitution supersedes ad-hoc practices. When a spec, plan, or implementation
  conflicts with it, the constitution wins or the conflict MUST be resolved before merge.
- **Amendments** MUST be proposed as a documented change to this file, including the
  rationale and a version bump, and MUST update any dependent templates/artifacts.
- **Versioning policy** (semantic):
  - MAJOR: backward-incompatible removal or redefinition of a principle or governance rule.
  - MINOR: a new principle/section or materially expanded guidance.
  - PATCH: clarifications, wording, or non-semantic refinements.
- **Compliance review**: Every plan's Constitution Check and every review MUST verify
  adherence. Unjustified complexity or principle violations block merge.

**Version**: 1.2.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-07-01
