import { describe, it, expect, vi } from "vitest";
import { GitHubTarget } from "../../src/lib/publish/gitTarget";

function mockFetch(handlers: (url: string, init?: RequestInit) => Response) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handlers(String(input), init)),
  ) as unknown as typeof fetch;
}

const cfg = { owner: "davd-gzl", repo: "postcards", branch: "gh-pages", token: "tok" };

describe("GitHubTarget", () => {
  it("creates a new file (no prior SHA) with base64 content on the branch", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchFn = mockFetch((url, init) => {
      calls.push({ url, init });
      if (init?.method === "PUT") return new Response("{}", { status: 201 });
      return new Response("Not Found", { status: 404 }); // no existing file
    });
    const t = new GitHubTarget({ ...cfg, fetchFn });
    await t.putFiles([{ path: "index.html", content: "<h1>Hi ☕</h1>" }], "publish");

    const put = calls.find((c) => c.init?.method === "PUT")!;
    const body = JSON.parse(String(put.init!.body));
    expect(body.branch).toBe("gh-pages");
    expect(body.sha).toBeUndefined(); // new file → no sha
    // base64 round-trips back to the UTF-8 source
    expect(Buffer.from(body.content, "base64").toString("utf-8")).toBe("<h1>Hi ☕</h1>");
    expect(put.url).toContain("/repos/davd-gzl/postcards/contents/index.html");
  });

  it("updates an existing file by passing its current SHA", async () => {
    let putBody: Record<string, unknown> | null = null;
    const fetchFn = mockFetch((_url, init) => {
      if (init?.method === "PUT") {
        putBody = JSON.parse(String(init.body));
        return new Response("{}", { status: 200 });
      }
      return new Response(JSON.stringify({ sha: "abc123" }), { status: 200 });
    });
    await new GitHubTarget({ ...cfg, fetchFn }).putFiles(
      [{ path: "data/journal.json", content: "{}" }],
      "sync",
    );
    expect(putBody!.sha).toBe("abc123");
  });

  it("throws a helpful error on an auth failure", async () => {
    const fetchFn = mockFetch(() => new Response("Bad creds", { status: 401 }));
    const t = new GitHubTarget({ ...cfg, fetchFn });
    await expect(t.putFiles([{ path: "x", content: "y" }], "m")).rejects.toThrow(/token's scope/);
  });

  it("requires owner, repo, branch and token", () => {
    expect(() => new GitHubTarget({ owner: "", repo: "r", branch: "b", token: "t" })).toThrow();
    expect(() => new GitHubTarget({ owner: "o", repo: "r", branch: "b", token: "" })).toThrow();
  });
});
