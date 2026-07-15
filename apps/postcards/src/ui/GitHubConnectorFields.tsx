import type { ChangeEvent } from "react";

// The GitHub connector's input fields (owner / repo / branch / token), shared by
// Publish mode (push a site) and Device sync (push the data file) so the token
// form lives in ONE place. Purely presentational and controlled: it holds no
// state and never stores the token itself — the parent decides whether the value
// lives only in memory (Publish) or on-device (Sync). `idPrefix` keeps the input
// ids unique when both a Publish modal and the Sync section are on the page.

export interface GitHubConnectorValue {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export function GitHubConnectorFields({
  idPrefix,
  value,
  onChange,
  repoPlaceholder = "my-postcards",
}: {
  idPrefix: string;
  value: GitHubConnectorValue;
  onChange: (next: GitHubConnectorValue) => void;
  repoPlaceholder?: string;
}) {
  const set =
    (key: keyof GitHubConnectorValue) => (e: ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: e.target.value });

  return (
    <>
      <div className="trip-form-row">
        <label className="picker-label" htmlFor={`${idPrefix}-owner`}>
          Owner
          <input
            id={`${idPrefix}-owner`}
            className="select"
            type="text"
            autoComplete="off"
            value={value.owner}
            onChange={set("owner")}
            placeholder="your-username"
          />
        </label>
        <label className="picker-label" htmlFor={`${idPrefix}-repo`}>
          Repo
          <input
            id={`${idPrefix}-repo`}
            className="select"
            type="text"
            autoComplete="off"
            value={value.repo}
            onChange={set("repo")}
            placeholder={repoPlaceholder}
          />
        </label>
        <label className="picker-label" htmlFor={`${idPrefix}-branch`}>
          Branch
          <input
            id={`${idPrefix}-branch`}
            className="select"
            type="text"
            autoComplete="off"
            value={value.branch}
            onChange={set("branch")}
            placeholder="main"
          />
        </label>
      </div>
      <label className="picker-label" htmlFor={`${idPrefix}-token`}>
        Token
        <input
          id={`${idPrefix}-token`}
          className="select"
          type="password"
          autoComplete="off"
          value={value.token}
          onChange={set("token")}
          placeholder="github_pat_…"
        />
      </label>
    </>
  );
}
