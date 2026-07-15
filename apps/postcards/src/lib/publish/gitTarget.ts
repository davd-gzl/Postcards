// Where a publish/sync push GOES — kept behind a small seam so the app never
// hard-codes a vendor (Constitution: zero lock-in). The default deliverable is a
// portable bundle you can drop on ANY static host or `git push` yourself; the
// GitHub connector below is ONE optional implementation of the same seam, used by
// both Publish mode (push the site) and Device sync (push the data file).
//
// Every push is an explicit user action (Constitution: data leaves the device
// only when the user asks). No SDK — plain fetch against the GitHub REST API, so
// there's no proprietary dependency and it works from the PWA or the native wrap.

export interface PublishFile {
  /** Repo-relative path, e.g. "index.html" or "data/journal.json". */
  path: string;
  /** UTF-8 text content. */
  content: string;
}

export interface PublishTarget {
  /** Human label for the destination (shown in the UI). */
  readonly name: string;
  /** Create/update the given files in one logical push. Throws on failure. */
  putFiles(files: PublishFile[], message: string): Promise<void>;
}

export interface GitHubTargetConfig {
  owner: string;
  repo: string;
  /** Branch to commit to (e.g. "main" or "gh-pages"). */
  branch: string;
  /** A fine-grained PAT with contents:write on the repo. Held only in memory /
   *  on-device; never bundled into an export. */
  token: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchFn?: typeof fetch;
  /** Override the API base (GitHub Enterprise). Defaults to github.com. */
  apiBase?: string;
}

const encodeContent = (text: string): string => {
  // UTF-8 → base64 (btoa is latin1-only, so widen first).
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/**
 * Push to a GitHub repo via the Contents API. Each file is upserted: we look up
 * its current blob SHA (needed to update), then PUT the new content. Sequential
 * on purpose — the Contents API is per-file and rate-limited, and a handful of
 * files (a small site or one data file) is the normal case.
 */
export class GitHubTarget implements PublishTarget {
  readonly name: string;
  private cfg: GitHubTargetConfig;
  private fetchFn: typeof fetch;
  private apiBase: string;

  constructor(cfg: GitHubTargetConfig) {
    if (!cfg.owner || !cfg.repo || !cfg.branch || !cfg.token) {
      throw new Error("GitHub target needs owner, repo, branch and a token.");
    }
    this.cfg = cfg;
    this.name = `github:${cfg.owner}/${cfg.repo}@${cfg.branch}`;
    this.fetchFn = cfg.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
    this.apiBase = (cfg.apiBase ?? "https://api.github.com").replace(/\/$/, "");
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private contentsUrl(path: string): string {
    const clean = path.replace(/^\/+/, "");
    const encoded = clean.split("/").map(encodeURIComponent).join("/");
    return `${this.apiBase}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${encoded}`;
  }

  /** Current blob SHA for a path on the target branch, or null if it doesn't exist. */
  private async currentSha(path: string): Promise<string | null> {
    const res = await this.fetchFn(
      `${this.contentsUrl(path)}?ref=${encodeURIComponent(this.cfg.branch)}`,
      { headers: this.headers() },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const detail = res.status === 401 || res.status === 403 ? " (check the token's scope)" : "";
      throw new Error(`GitHub read failed for ${path} (${res.status})${detail}.`);
    }
    const body = (await res.json()) as { sha?: string };
    return body.sha ?? null;
  }

  async putFiles(files: PublishFile[], message: string): Promise<void> {
    for (const file of files) {
      const sha = await this.currentSha(file.path);
      const res = await this.fetchFn(this.contentsUrl(file.path), {
        method: "PUT",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          content: encodeContent(file.content),
          branch: this.cfg.branch,
          ...(sha ? { sha } : {}),
        }),
      });
      if (!res.ok) {
        const detail = res.status === 401 || res.status === 403 ? " (check the token's scope)" : "";
        throw new Error(`GitHub write failed for ${file.path} (${res.status})${detail}.`);
      }
    }
  }
}
