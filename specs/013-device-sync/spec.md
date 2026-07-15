# Feature Specification: Device sync (phone ↔ laptop)

**Feature Directory**: `specs/013-device-sync`

**Created**: 2026-07-15

**Status**: Draft — designed with the maintainer

**Input**: User description: "Keep my postcards in sync across my devices without a server or an
account. My phone and my laptop should both end up holding the same visits, trips, and journal
stories, even when I edited different things on each while offline. Do it through the portable JSON
file I already own — put it in a git repo, and have each device pull, merge, and push, reusing the
same git connector as the Publish Sync button. Merge at the record level (never overwrite the whole
file) so two devices always converge. Later, let me also sync two devices directly over the local
network with no cloud at all. Stay privacy-first: sync only when I press a button, no telemetry, no
account, encrypted in transit."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sync everything through a git remote with one button (Priority: P1)

The user has already connected a git remote (the same connector the Publish "Sync" button uses — any
git host; GitHub is one example). On each device they press **Sync**. The device pulls the latest
portable data file from the remote, merges it record-by-record into local data, and pushes the merged
result back. After both devices have synced once, they hold the same visits, trips, and stories.

**Why this priority**: This is the whole feature at its smallest useful size — one button that makes a
phone and a laptop agree — and it reuses infrastructure the app already has (the portable JSON file
and the git connector). Everything else refines how the merge behaves.

**Independent Test**: On device A add a visit and press Sync. On device B (a different install, same
git remote) press Sync. Confirm the visit from A now appears on B, with no account and no manual file
handling.

**Acceptance Scenarios**:

1. **Given** a configured git remote and local changes, **When** the user presses Sync, **Then** the
   device pulls the remote file, merges it into local data, pushes the result, and reports how many
   records were added, updated, and removed.
2. **Given** two devices sharing one git remote, **When** each device presses Sync once (A then B),
   **Then** both devices and the remote hold the same set of visits, trips, and stories.
3. **Given** the remote already holds the file, **When** a fresh install presses Sync for the first
   time, **Then** all remote records are imported locally with no loss and nothing is overwritten
   destructively.
4. **Given** no network is available, **When** the user presses Sync, **Then** the app reports that
   sync could not reach the remote and leaves local data unchanged (no partial or corrupt state).

---

### User Story 2 - Concurrent offline edits on two devices converge (Priority: P1)

The user edits on both devices while each is offline — a new city on the phone, an edited note on the
laptop, a favourite toggled on one of them. When both later sync, no edit is lost and both devices
reach the same state, regardless of which one synced first.

**Why this priority**: Record-level, deterministic merge is the reason this feature exists rather than
"copy the file across." Whole-file overwrite would silently lose one device's work; convergence is the
promise that makes sync safe to trust.

**Independent Test**: With both devices offline, add a different visit on each and edit an existing
visit's note on each. Sync both (in either order). Confirm every change from both devices is present
on both devices afterward and the two states are byte-identical.

**Acceptance Scenarios**:

1. **Given** device A added record X and device B added record Y while offline, **When** both sync,
   **Then** both devices hold both X and Y (id-keyed upsert; no record dropped).
2. **Given** the same record was edited on both devices, **When** both sync, **Then** the version with
   the newer `updatedAt` wins on both devices (newest-wins per record), deterministically.
3. **Given** two devices sync in the opposite order on a later run, **When** the merge runs, **Then**
   the converged result is identical regardless of sync order (the merge is commutative and
   idempotent).
4. **Given** a record exists unchanged on one device and edited on the other, **When** they sync,
   **Then** the edited version is kept and the untouched record is never resurrected to an older state.

---

### User Story 3 - Deletions propagate instead of coming back (Priority: P2)

The user deletes a visit on one device. After syncing, that visit is gone on the other device too, and
it does not reappear on the next sync just because the other device still remembered it.

**Why this priority**: Without an explicit deletion signal, a naive newest-wins merge treats "missing
on device A" as "device A simply hasn't seen it yet" and re-adds it forever. Deletions must be
first-class, but they layer on top of the additive merge core, so they follow it.

**Independent Test**: Sync a visit to both devices. Delete it on device A and sync both. Confirm the
visit is absent on both devices and stays absent after a second round of syncing.

**Acceptance Scenarios**:

1. **Given** a record present on both devices, **When** it is deleted on device A and both sync,
   **Then** the record is removed on device B and does not reappear on subsequent syncs.
2. **Given** a record deleted on device A and edited on device B before either syncs, **When** they
   sync, **Then** the newest action wins by timestamp (a deletion newer than the edit removes it; an
   edit newer than the deletion keeps the edit) — deterministically on both devices.
3. **Given** deletions have propagated everywhere, **When** the app decides tombstones are safely old,
   **Then** it may retire them without resurrecting any deleted record.

---

### User Story 4 - Direct device-to-device sync with no cloud (Priority: P3, Phase 2)

Two devices on the same local network sync directly to each other — no git remote, no internet, no
server. The user pairs them by scanning a QR code shown on one device with the other, opening an
encrypted peer-to-peer channel, and the same record-level merge runs over that channel.

**Why this priority**: This honours the constitution most fully (no third party ever touches the data,
even in transit) but is materially heavier to build (pairing, signalling, a data channel) and is not
needed to deliver working cross-device sync. It is specified as a future phase, not part of the MVP.

**Independent Test**: With both devices on one Wi-Fi network and no internet, pair by QR, run sync, and
confirm records merge both ways — with network inspection showing no traffic to any remote host.

**Acceptance Scenarios**:

1. **Given** two devices on the same local network, **When** the user pairs them via QR code, **Then**
   an encrypted direct channel is established without any cloud service or account.
2. **Given** a paired direct channel, **When** the user runs sync, **Then** the identical record-level
   merge (Stories 2–3) runs over the channel and both devices converge.
3. **Given** a direct sync session, **When** traffic is inspected, **Then** no user data is sent to any
   server or third-party host — only device-to-device over the local network.

---

### Edge Cases

- The remote was pushed by the other device between this device's pull and push (non-fast-forward) →
  the app re-pulls, re-merges, and re-pushes automatically; the user never resolves a git text
  conflict by hand.
- Two records carry the same `updatedAt` on the same id → a stable deterministic tie-break (e.g. by
  record id) is applied so both devices pick the same winner.
- Device clocks disagree (clock skew) → newest-wins uses the recorded `updatedAt`; the app does not
  trust one device's clock over another beyond that, and the tie-break keeps the result deterministic.
- The pulled file is malformed, truncated, or hostile → it is validated and sanitized exactly like a
  manual import (inert data), never executed, and sync aborts with a clear reason rather than
  corrupting local data.
- The pulled file uses an older schema version → it is migrated on read before merging, with no loss.
- A record was deleted on device A and never seen by device B (B was offline the whole time) → the
  tombstone propagates so B removes it rather than re-adding it on B's next push.
- A tombstone is retired (garbage-collected) too early and a lagging device re-adds the record → the
  retirement rule requires evidence the deletion has reached all known peers/the remote before a
  tombstone is dropped.
- Sync is pressed twice in quick succession → the second run is a no-op or safely idempotent; running
  sync repeatedly never changes converged data.
- The git remote is unreachable, denies auth, or the repo is empty → each case yields a distinct, clear
  message and leaves local data untouched.
- Photos or other large blobs travel inside the portable file → they merge as their parent record does;
  a record's newest-wins version carries its photos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sync MUST be explicit and user-initiated (a Sync button/action); the app MUST NOT sync in
  the background, on a timer, or without the user's action.
- **FR-002**: Git-mode sync MUST reuse the existing git connector (the same one behind the Publish
  "Sync" button) and MUST work with any standard git remote, with no dependence on a specific provider
  (GitHub is one example; zero lock-in).
- **FR-003**: A sync run MUST pull the latest portable data file from the remote, merge it into local
  data, and push the merged result back — in that order.
- **FR-004**: The merge MUST operate at the record level as an id-keyed upsert per collection (visits
  by `visitId`, trips by `tripId`, stories by `storyId`, and any other user record collections),
  reusing the app's non-destructive merge pattern. It MUST NEVER overwrite the whole file, so two
  devices always converge rather than one clobbering the other.
- **FR-005**: When the same record id exists on both sides with different content, the version with the
  newer `updatedAt` MUST win (newest-wins per record), applied identically on every device.
- **FR-006**: Every user record MUST carry an `updatedAt` timestamp that is set on creation and updated
  on every mutation of that record, so newest-wins has a field to compare.
- **FR-007**: The merge MUST be deterministic, commutative, and idempotent: the converged result MUST
  be identical regardless of the order in which devices sync, and re-running sync on converged data
  MUST change nothing.
- **FR-008**: Ties (equal `updatedAt` for the same id) MUST be broken by a stable, deterministic rule
  (e.g. by record id) so all devices choose the same winner.
- **FR-009**: Deletions MUST be represented as tombstones (an id plus a `deletedAt` timestamp) carried
  in the synced data, so a deletion propagates to other devices instead of the record being re-added.
- **FR-010**: A delete-vs-edit conflict for the same record MUST resolve by newest action: a deletion
  newer than the last edit removes the record; an edit newer than the deletion keeps the edit —
  deterministically on all devices.
- **FR-011**: The system MUST define and apply a safe tombstone-retirement (garbage-collection) rule
  that only retires a tombstone once the deletion has demonstrably reached the remote/all known peers,
  so retiring it cannot resurrect a deleted record.
- **FR-012**: If the push is rejected because the remote advanced since the pull (non-fast-forward),
  the system MUST automatically re-pull, re-merge, and re-push, without surfacing a manual git
  text-conflict resolution to the user.
- **FR-013**: The pulled file MUST be validated against the published, versioned schema and sanitized
  exactly as a manual import is (inert data); malformed, truncated, or hostile content MUST be rejected
  or sanitized and MUST NEVER be executed or evaluated.
- **FR-014**: A pulled file on an older schema version MUST be migrated before merging, preserving all
  data.
- **FR-015**: A failed or interrupted sync MUST leave local data in a consistent state — either the
  fully merged result or the unchanged prior state, never a partial or corrupt mix.
- **FR-016**: The system MUST report the outcome of a sync run (records added, updated, removed, and
  any error) so the user can see what changed.
- **FR-017**: Sync MUST move only personal user data (visits, trips, stories, tombstones, and their
  metadata); bundled read-only reference datasets MUST NOT be synced.
- **FR-018**: User data MUST NOT be sent to any server or third party other than the git remote the
  user explicitly configured; there MUST be no account, no telemetry, and no analytics in the sync
  path.
- **FR-019**: Data MUST be encrypted in transit where the transport supports it (e.g. an HTTPS or SSH
  git remote); the app MUST NOT downgrade or disable transport security to complete a sync.
- **FR-020**: Any remote credentials or tokens MUST be stored using the device's secure storage and
  MUST NEVER be written into the portable data file or any exported/synced artifact.
- **FR-021**: The synced unit MUST remain the one portable, human-readable JSON file (the existing
  source of truth), so the same repository is also a plain backup a user can read and restore without
  the app.
- **FR-022** *(Phase 2)*: The system SHOULD support direct device-to-device sync over the local network
  via an encrypted peer-to-peer channel (e.g. WebRTC data channel), paired by QR code, with no cloud
  service, server, or account involved.
- **FR-023** *(Phase 2)*: Direct device-to-device sync MUST reuse the identical record-level merge
  engine (FR-004 through FR-011) so its convergence, conflict, and deletion behaviour matches git-mode
  sync exactly.

### Key Entities *(include if feature involves data)*

- **Synced Record**: Any user-authored record that participates in sync (Visit, Trip, Story, …),
  identified by its stable id and carrying an `updatedAt` timestamp. The id is the merge key; the
  `updatedAt` is the newest-wins comparator.
- **Tombstone**: A deletion marker — a record id plus a `deletedAt` timestamp — carried in the synced
  data so a delete on one device propagates to others and is not undone by a device that still holds
  the record. Subject to a safe retirement rule.
- **Merge Result**: The outcome of merging incoming records and tombstones into local data — counts of
  records added, updated, and removed — reported to the user and independent of merge order.
- **Sync Remote**: The user-configured git remote (URL plus securely stored credentials) that holds the
  portable file; the shared meeting point in git mode. Any git host; not provider-specific.
- **Portable Data File**: The single versioned JSON source of truth, unchanged as a format, that is
  pulled, merged, and pushed — also readable as a plain backup without the app.
- **Peer Session** *(Phase 2)*: A paired, encrypted, direct connection between two devices over the
  local network, established by QR pairing, over which the same merge runs with no cloud in between.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After two devices sharing a git remote each press Sync once, both devices and the remote
  hold an identical set of visits, trips, and stories (100% record equivalence).
- **SC-002**: When each device made different offline edits (including edits to the same record), a
  full sync loses zero edits: every change made on either device is present on both afterward.
- **SC-003**: The converged state is independent of sync order — syncing A-then-B and B-then-A produce
  byte-identical results in 100% of test cases.
- **SC-004**: A record deleted on one device is absent on the other after both sync and stays absent
  across at least two further sync rounds (no resurrection).
- **SC-005**: Re-running sync on already-converged data changes nothing (0 records added/updated/removed
  reported), confirming idempotence.
- **SC-006**: During sync, zero user data is sent to any host other than the user's configured git
  remote, verifiable by network inspection.
- **SC-007**: A malformed or hostile pulled file is never executed and is always rejected or sanitized
  with local data left intact (100% of adversarial cases).
- **SC-008**: A failed sync (no network, auth denied, empty repo) leaves local data byte-identical to
  its pre-sync state in 100% of cases and shows a clear, distinct reason.
- **SC-009** *(Phase 2)*: Two devices on a local network with no internet complete a full two-way sync
  by QR pairing with zero traffic to any remote host.

## Assumptions

- The user already has, or will configure, a git remote — the same connector the Publish "Sync" button
  uses. Provisioning that remote/connector is out of scope here; this feature consumes it.
- An `updatedAt` field is added to each synced record type (a schema-version bump). On migrating older
  data that predates it, `updatedAt` is backfilled from the record's existing `addedAt` timestamp.
- The intended use is one person syncing their own devices, not multiple people collaboratively editing
  the same dataset. Newest-wins-per-record (last writer wins by wall-clock `updatedAt`) is an
  acceptable and understandable conflict rule for that case; sub-record three-way field merging is not
  required.
- Newest-wins relies on device clocks being roughly correct; gross clock skew is an accepted risk, and
  the deterministic tie-break guarantees devices still converge even when timestamps collide.
- Photos and other blobs continue to travel inside the portable file (as they already do for
  backup/restore) and merge as part of their parent record; no separate binary-sync channel is assumed
  for the MVP.
- Reference datasets are bundled and read-only and are deliberately excluded from sync so users move
  only their own records.
- Sync frequency is entirely user-driven; the app does not attempt real-time or background convergence.

## Out of Scope

- Real-time or background/continuous sync — sync is always a manual, button-triggered action.
- Multi-user collaboration, shared datasets, or presence — this is single-user, multi-device sync only.
- Field-level (sub-record) three-way merging or operational-transform/CRDT-style co-editing; the merge
  is per-record newest-wins with tombstones.
- Any hosted sync service, relay, or backend run by the project; the only remote is the user's own git
  remote (MVP) or a direct local peer (Phase 2).
- Provisioning, authenticating, or managing the git remote/connector itself (owned by the Publish
  feature); this spec only consumes it.
- End-to-end at-rest encryption of the file on the remote — the file remains the same readable JSON
  backup; transport encryption is in scope, remote-side confidentiality of a repo the user controls is
  the user's choice.
- Conflict-resolution UI for hand-picking between two versions of a record — resolution is automatic
  and deterministic.
- The full Phase 2 peer-to-peer transport (WebRTC/local-network pairing and signalling); it is
  specified here as a future story but is not part of the MVP build.
