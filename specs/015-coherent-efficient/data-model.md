# Data Model: Coherent & Efficient Postcards

This feature is mostly IA/interaction/durability over **existing** data — it adds almost no
new persisted data. The canonical portable JSON file and its versioned schema are unchanged
except for small, additive, backward-compatible settings/metadata. Reference vs personal
data stays strictly separated.

## Existing entities (unchanged shape; access reorganized)

- **Place** — a location the user relates to. Kind: `city | country(derived) | airport |
  heritage | monument | custom`. Personal fields: `status` (visited / wishlist), `favorite`,
  `folder`, optional `photo`/coordinates. Reference-sourced fields carry provenance.
  *Change*: new one-tap views (Favorites, Wishlist, Monuments-near-me) and the full
  sort/filter matrix are **views over Place**, not new storage.
- **Trip** — named grouping of visits/steps over a period. *Change*: surfaced as a
  first-class filter across map, lists, and journal (This-trip). No shape change.
- **Journal entry (Story)** — dated, titled note about a place with text + photos. *Change*:
  composer opens on demand; sort/filter/search parity. No shape change.
- **Portable data file** — the single human-readable JSON (+ Markdown export) that is the
  source of truth, backup unit, and transfer payload. Versioned schema (Zod). Validated +
  sanitized on import, never executed. *Change*: becomes the QR/file transfer payload and
  the restore unit; no format break.
- **Published site** — self-contained HTML generated from the user's data; no secrets, no
  external requests. *Change*: leads the sharing flow (drag-to-host). No shape change.

## Settings / app-mode (existing store, additive keys)

- **`offlineMode`** (exists) — becomes the **single** egress gate (Theme 1). Boolean.
- **`onlineMap`** (exists) — retained but governed by `offlineMode`; the map-local basemap
  toggle is removed as a *source of truth*.
- Grouped online preferences (auto-load guides, data-pack fetches, downloads) — unchanged
  values; regrouped in Settings UI.

## New durability metadata (additive, small, local only)

Stored in local settings/localStorage (not the portable file, since they describe *this
device's* protection state):

- **`persistenceState`** — derived at runtime from `navigator.storage.persisted()` /
  `estimate()`: `granted | denied | unknown`. Not user-editable; displayed as a
  protection indicator. (Native: effectively `granted`.)
- **`lastBackupAt`** — ISO timestamp of the last successful export/transfer. Written by the
  backup/transfer actions; read to show "last backed up …" and to decide when to nudge.
- **`dataDirtySinceBackup`** — derived: true when personal data changed after `lastBackupAt`
  (drives the gentle backup prompt). Computed, not a new persisted field beyond a change
  marker already implied by the store.

**Validation / rules**:
- `lastBackupAt` updates only on a *confirmed* successful backup/transfer (never optimistic).
- The protection indicator never blocks use; it warns and links to backup (FR-029).
- None of these device-local fields travel in the portable file (they are per-device).

## QR transfer payload (Theme 4)

- **Payload = the portable JSON file** (the same validated schema), optionally without
  inlined photos for size, compressed for the QR channel. The receiver runs the **identical
  import validation/sanitization** path — a QR import is not a privileged path.
- **Size guard**: if the compressed payload exceeds a safe single-QR capacity, the UI
  switches to the file hand-off and says why (no silent truncation).

## State transitions

- **App mode**: `Online ⇄ Offline` via the top-bar chip or Settings; flipping to Offline
  immediately halts optional fetching everywhere.
- **Backup freshness**: `clean → dirty` on any personal-data mutation; `dirty → clean` on a
  confirmed backup/transfer; drives the nudge.
- **Persistence**: `unknown → granted|denied` after the first persistence request on first
  real data write; native shell starts effectively `granted`.

## Non-changes (explicitly)

- No schema version bump is required for the feature's core; any additive field is optional
  and backward-compatible. No new reference datasets. No account, credential, or server-side
  record of any kind.
