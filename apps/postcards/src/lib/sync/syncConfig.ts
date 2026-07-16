// On-device sync configuration (spec 013): the git remote (owner / repo / branch /
// token) plus the "last synced" stamp. Shared by the Sync settings section and the
// auto-sync hook so BOTH read/write one place.
//
// SECURITY: the token lives ONLY here in localStorage on this device. It is never
// written into the portable file, any export, the sync log, or a native store —
// see serialize() in runSync, which never touches it. `readRemoteConfig` trims so
// stray whitespace can't create a "half-configured" state.

/** The synced unit is the one portable JSON file, so the repo doubles as a plain,
 *  readable backup a user can restore without the app (FR-021). */
export const SYNC_PATH = "places.postcards.json";

export const SYNC_KEYS = {
  owner: "postcards-sync-owner",
  repo: "postcards-sync-repo",
  branch: "postcards-sync-branch",
  token: "postcards-sync-token",
  last: "postcards-sync-last",
} as const;

export interface RemoteConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode: not persisted */
  }
}

/** The saved remote config, trimmed. Branch defaults to "main" when unset. */
export function readRemoteConfig(): RemoteConfig {
  return {
    owner: read(SYNC_KEYS.owner).trim(),
    repo: read(SYNC_KEYS.repo).trim(),
    branch: read(SYNC_KEYS.branch).trim() || "main",
    token: read(SYNC_KEYS.token).trim(),
  };
}

export function writeRemoteConfig(cfg: RemoteConfig): void {
  write(SYNC_KEYS.owner, cfg.owner.trim());
  write(SYNC_KEYS.repo, cfg.repo.trim());
  write(SYNC_KEYS.branch, cfg.branch.trim());
  write(SYNC_KEYS.token, cfg.token.trim());
}

/** Forget the remote entirely (Disconnect), token included. */
export function clearRemoteConfig(): void {
  write(SYNC_KEYS.owner, "");
  write(SYNC_KEYS.repo, "");
  write(SYNC_KEYS.branch, "");
  write(SYNC_KEYS.token, "");
}

/** A remote is usable only when every field (including the token) is present. */
export function isConfigured(cfg: RemoteConfig): boolean {
  return !!(cfg.owner && cfg.repo && cfg.branch && cfg.token);
}

export function readLastSynced(): string {
  return read(SYNC_KEYS.last);
}

export function writeLastSynced(iso: string): void {
  write(SYNC_KEYS.last, iso);
}

// ── Safety guard threshold ──────────────────────────────────────────────────
// Below this many local records a large-fraction deletion is a normal edit, not a
// suspicious wipe — don't nag on small datasets.
export const GUARD_MIN_LOCAL = 10;
// Gate a pull that would remove MORE than this fraction of local records. A reset
// or emptied remote removes ~all of them; a routine "deleted a few places" removes
// a small fraction and passes straight through.
export const GUARD_MAX_REMOVAL_RATIO = 0.5;

/**
 * The safety-guard decision (pure, unit-tested): should this pull be BLOCKED for
 * confirmation because it would wipe a surprising share of the device's data?
 * Returns false for ordinary deletions and tiny datasets; true only when a large
 * fraction of a non-trivial local store would vanish.
 */
export function shouldGuardRemoval(
  info: { local: number; removed: number },
  opts?: { minLocal?: number; maxRemovalRatio?: number },
): boolean {
  const minLocal = opts?.minLocal ?? GUARD_MIN_LOCAL;
  const ratio = opts?.maxRemovalRatio ?? GUARD_MAX_REMOVAL_RATIO;
  if (info.removed <= 0) return false;
  if (info.local < minLocal) return false;
  return info.removed / info.local > ratio;
}
