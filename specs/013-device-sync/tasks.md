# Tasks — 013 Device sync (phone ↔ laptop)

Dependency-ordered implementation breakdown. Git mode first; P2P is phase 2.
The convergent merge CORE already exists and is tested (`src/lib/sync/merge.ts`)
and the git connector is shared with Publish mode (`src/lib/publish/gitTarget.ts`).

## Phase A — record timestamps (foundation)
- [ ] T001 Add `updatedAt` (ISO string) to Visit / Trip / Story in `src/lib/schema/models.ts`
      — optional + defaulted so older portable files still validate; export writes it.
- [ ] T002 Stamp `updatedAt` on every mutating store path (`useVisits`, `useTrips`, `useStories`
      add/update/toggle/merge) and on IndexedDB writes; keep `addedAt` immutable.
- [ ] T003 Migration: on load, backfill `updatedAt = addedAt` for records that lack it.
- [ ] T004 Tests: merge picks the newer `updatedAt`; a toggle bumps it; import backfills.

## Phase B — deletions as tombstones
- [ ] T005 A small tombstone store (IndexedDB) recording `{id, deletedAt}` when a record is removed.
- [ ] T006 Wire removes in the three stores to also write a tombstone.
- [ ] T007 `gcTombstones` on a conservative horizon (e.g. 90 days) at a safe point.

## Phase C — sync engine (git mode)
- [ ] T008 `src/lib/sync/engine.ts` — `syncOnce({ local, remote })`: pull the remote portable
      file, build per-store `SyncSnapshot`s, `mergeById` each (visits/trips/stories) with tombstones,
      write the merged result locally (one transaction) AND push it back via the git target.
      Deterministic; a non-fast-forward on push → re-pull, re-merge, retry.
- [ ] T009 Reuse `GitHubTarget` for push; add a minimal pull (GET the file's raw content via the
      Contents API). Keep the connector generic (any git remote is the ideal; GitHub is one impl).
- [ ] T010 Tests: two divergent snapshots converge after a round-trip; delete-then-sync stays deleted;
      concurrent edits keep the newer; idempotent re-sync is a no-op.

## Phase D — UI
- [ ] T011 A "Sync" section in Settings: remote config (owner/repo/branch + token, stored on-device),
      a "Sync now" button, last-synced time, and clear status/errors. Explicit action only.
- [ ] T012 Shared connector UI with Publish mode's GitHub push (don't duplicate the token form).
- [ ] T013 Privacy note: no server, no account, encrypted-in-transit where applicable, no telemetry.

## Phase E — P2P (phase 2, later)
- [ ] T014 QR-paired WebRTC data channel over the local network; exchange snapshots; same merge core.
      No cloud. Spec'd as a future story — not part of the git-mode MVP.

Constitution: local-first, decentralized (no server/account), privacy by default, inert imports
validated, zero lock-in, WCAG AA for the UI.
