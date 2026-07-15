import { describe, it, expect } from "vitest";
import { encryptJson, decryptJson, isEncryptedEnvelope } from "../../src/lib/publish/encrypt";

describe("publish/encrypt", () => {
  it("round-trips JSON through a passphrase", async () => {
    const data = { title: "Three weeks in Japan", steps: [1, 2, 3], note: "Café ☕ — 東京" };
    const env = await encryptJson(data, "correct horse battery staple");
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(env.alg).toBe("AES-GCM");
    const back = await decryptJson(env, "correct horse battery staple");
    expect(back).toEqual(data);
  });

  it("fails with the wrong passphrase and never returns plaintext", async () => {
    const env = await encryptJson({ secret: 42 }, "hunter2");
    await expect(decryptJson(env, "wrong")).rejects.toThrow(/passphrase|damaged/i);
  });

  it("produces a fresh salt and iv each time (no deterministic reuse)", async () => {
    const a = await encryptJson({ x: 1 }, "pw");
    const b = await encryptJson({ x: 1 }, "pw");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("rejects a non-envelope payload", async () => {
    expect(isEncryptedEnvelope({ hello: "world" })).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(decryptJson({ hello: "world" } as any, "pw")).rejects.toThrow();
  });

  it("refuses to encrypt with an empty passphrase", async () => {
    await expect(encryptJson({ x: 1 }, "")).rejects.toThrow(/passphrase/i);
  });
});
