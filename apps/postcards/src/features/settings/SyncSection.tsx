import { useState } from "react";
import { GitHubConnectorFields, type GitHubConnectorValue } from "../../ui/GitHubConnectorFields";
import { normalizeVisitPhotos, backfillUpdatedAt } from "../../lib/schema/helpers";
import type { SyncTombstone } from "../../lib/schema/models";
import {
  getAllTombstones,
  replaceAllPortable,
  type TombstoneRecord,
  type TombstoneKind,
} from "../../lib/db/visitsDb";
import { useVisits } from "../../lib/store/useVisits";
import { useTrips } from "../../lib/store/useTrips";
import { sortStories, useStories } from "../../lib/store/useStories";
import type { StoreSnapshots, SyncCounts } from "../../lib/sync/engine";

// Device sync (git mode), spec 013. Explicit-action only: nothing syncs until the
// user taps "Sync now". The remote config lives on THIS device (localStorage); the
// token never enters the portable file or any export (FR-020). The heavy codec +
// engine load on tap, so this section costs the boot chunk nothing.

const KEYS = {
  owner: "postcards-sync-owner",
  repo: "postcards-sync-repo",
  branch: "postcards-sync-branch",
  token: "postcards-sync-token",
  last: "postcards-sync-last",
} as const;

// The synced unit is the same one portable JSON file, so the repo doubles as a
// plain, readable backup (FR-021).
const SYNC_PATH = "places.postcards.json";

function readLocal(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeLocal(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode: not persisted */
  }
}

/** "+2 · ~1 · −0" style summary of one collection's changes, for the status line. */
function summarize(label: string, c: SyncCounts): string | null {
  if (c.added === 0 && c.updated === 0 && c.removed === 0) return null;
  return `${label}: +${c.added} added, ${c.updated} updated, −${c.removed} removed`;
}

const kinds: TombstoneKind[] = ["visit", "trip", "story"];

export function SyncSection() {
  const [cfg, setCfg] = useState<GitHubConnectorValue>(() => ({
    owner: readLocal(KEYS.owner),
    repo: readLocal(KEYS.repo),
    branch: readLocal(KEYS.branch) || "main",
    token: readLocal(KEYS.token),
  }));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [lastSynced, setLastSynced] = useState<string>(() => readLocal(KEYS.last));

  function update(next: GitHubConnectorValue) {
    setCfg(next);
    writeLocal(KEYS.owner, next.owner.trim());
    writeLocal(KEYS.repo, next.repo.trim());
    writeLocal(KEYS.branch, next.branch.trim());
    writeLocal(KEYS.token, next.token.trim());
  }

  async function onSync() {
    const owner = cfg.owner.trim();
    const repo = cfg.repo.trim();
    const branch = cfg.branch.trim() || "main";
    const token = cfg.token.trim();
    if (!owner || !repo || !branch || !token) {
      setStatus({ kind: "err", text: "Fill in owner, repo, branch and a token to sync." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      // Load the codec (Zod) + engine + connector on demand — off the boot path.
      const [{ importFile }, { serializeFile }, { GitHubTarget }, engine] = await Promise.all([
        import("../backup/importJson"),
        import("../backup/exportJson"),
        import("../../lib/publish/gitTarget"),
        import("../../lib/sync/engine"),
      ]);

      const localTombs = await getAllTombstones();
      const pick = (kind: TombstoneKind) =>
        localTombs.filter((t) => t.kind === kind).map(({ id, deletedAt }) => ({ id, deletedAt }));

      const local: StoreSnapshots = {
        visits: { records: useVisits.getState().visits, tombstones: pick("visit") },
        trips: { records: useTrips.getState().trips, tombstones: pick("trip") },
        stories: { records: useStories.getState().stories, tombstones: pick("story") },
      };

      // Validate + sanitize the pulled file exactly as a manual import does (inert;
      // never executed) — a malformed/hostile file throws and aborts the sync.
      const parse = (text: string): StoreSnapshots => {
        const r = importFile(text);
        if (!r.ok) throw new Error(r.error);
        const partition = (kind: TombstoneKind) =>
          r.tombstones.filter((t) => t.kind === kind).map(({ id, deletedAt }) => ({ id, deletedAt }));
        return {
          visits: { records: r.visits.map(backfillUpdatedAt), tombstones: partition("visit") },
          trips: { records: r.trips.map(backfillUpdatedAt), tombstones: partition("trip") },
          stories: { records: r.stories.map(backfillUpdatedAt), tombstones: partition("story") },
        };
      };

      const serialize = (merged: StoreSnapshots): string => {
        const tombs: SyncTombstone[] = kinds.flatMap((kind) => {
          const snap =
            kind === "visit" ? merged.visits : kind === "trip" ? merged.trips : merged.stories;
          return snap.tombstones.map((t) => ({ kind, id: t.id, deletedAt: t.deletedAt }));
        });
        return serializeFile(
          merged.visits.records,
          merged.trips.records,
          merged.stories.records,
          new Date(),
          tombs,
        );
      };

      const persist = async (merged: StoreSnapshots): Promise<void> => {
        const records: TombstoneRecord[] = kinds.flatMap((kind) => {
          const snap =
            kind === "visit" ? merged.visits : kind === "trip" ? merged.trips : merged.stories;
          return snap.tombstones.map((t) => ({
            key: `${kind}:${t.id}`,
            kind,
            id: t.id,
            deletedAt: t.deletedAt,
          }));
        });
        // Records AND tombstones in one transaction (FR-015).
        await replaceAllPortable(
          merged.visits.records,
          merged.trips.records,
          merged.stories.records,
          records,
        );
        useVisits.setState({
          visits: merged.visits.records.map(normalizeVisitPhotos).map(backfillUpdatedAt),
        });
        useTrips.setState({ trips: merged.trips.records.map(backfillUpdatedAt) });
        useStories.setState({ stories: sortStories(merged.stories.records.map(backfillUpdatedAt)) });
      };

      const target = new GitHubTarget({ owner, repo, branch, token });
      const remote = engine.gitHubSyncRemote(target, SYNC_PATH);
      const result = await engine.syncOnce({ localSnapshots: local, remote, parse, serialize, persist });

      const parts = [
        summarize("Places", result.visits),
        summarize("Trips", result.trips),
        summarize("Stories", result.stories),
      ].filter((s): s is string => s !== null);
      const nothing =
        result.total.added === 0 && result.total.updated === 0 && result.total.removed === 0;
      const when = new Date().toISOString();
      writeLocal(KEYS.last, when);
      setLastSynced(when);
      setStatus({
        kind: "ok",
        text: result.createdRemote
          ? "Created the file on the remote and pushed your data."
          : nothing
            ? "Already in sync — nothing changed."
            : `Synced. ${parts.join(" · ")}.`,
      });
    } catch (e) {
      // Local data is untouched on any failure (network, auth, malformed file).
      setStatus({
        kind: "err",
        text:
          e instanceof Error
            ? `Sync failed: ${e.message} Your data on this device is unchanged.`
            : "Sync failed — your data on this device is unchanged.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section" aria-label="Device sync">
      <h3>Sync across your devices</h3>
      <p className="muted small">
        Keep your visits, trips and journal the same on your phone and laptop through a git repo you
        own — no server, no account. Each device pulls the shared file, merges it record-by-record
        (newest edit wins, deletions stick), and pushes it back. It runs only when you tap Sync.
      </p>

      <GitHubConnectorFields idPrefix="sync-gh" value={cfg} onChange={update} />

      <div className="btn-row sync-actions">
        <button className="btn" type="button" onClick={() => void onSync()} disabled={busy}>
          {busy ? "Syncing…" : "Sync now"}
        </button>
        {lastSynced && (
          <span className="muted small sync-last">
            Last synced {new Date(lastSynced).toLocaleString()}
          </span>
        )}
      </div>

      {status && (
        <p
          className={"notice" + (status.kind === "err" ? " notice-err" : " notice-ok")}
          role="status"
          aria-live="polite"
        >
          {status.text}
        </p>
      )}

      <p className="muted small">
        Privacy: no server, no account, no telemetry. Your data leaves this device only when you tap
        Sync, and only to the git remote you set here. The connection uses the remote's own transport
        security (HTTPS). The token is stored on this device only — never inside the synced file.
      </p>
    </section>
  );
}
