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
    const env = await encryptJson({ secret: 42 }, "hunter2000");
    await expect(decryptJson(env, "wrong-guess")).rejects.toThrow(/passphrase|damaged/i);
  });

  it("produces a fresh salt and iv each time (no deterministic reuse)", async () => {
    const a = await encryptJson({ x: 1 }, "passphrase-x");
    const b = await encryptJson({ x: 1 }, "passphrase-x");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("rejects a non-envelope payload", async () => {
    expect(isEncryptedEnvelope({ hello: "world" })).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(decryptJson({ hello: "world" } as any, "passphrase-x")).rejects.toThrow();
  });

  it("refuses to encrypt with an empty passphrase", async () => {
    await expect(encryptJson({ x: 1 }, "")).rejects.toThrow(/passphrase/i);
  });

  it("refuses a passphrase below the length floor (offline-crackable file)", async () => {
    await expect(encryptJson({ x: 1 }, "short")).rejects.toThrow(/at least/i);
    await expect(encryptJson({ x: 1 }, "1234567")).rejects.toThrow(/at least/i); // 7 chars
    // Exactly the floor is allowed.
    await expect(encryptJson({ x: 1 }, "12345678")).resolves.toBeTruthy();
  });

  it("derives at the hardened iteration count (>= OWASP 600k)", async () => {
    const env = await encryptJson({ x: 1 }, "passphrase-x");
    expect(env.iter).toBeGreaterThanOrEqual(600_000);
  });

  it("clamps a tampered low iteration count instead of trusting it", async () => {
    const env = await encryptJson({ x: 1 }, "passphrase-x");
    // A hostile file that sets iter=1 must not decrypt under a 1-round KDF: the
    // reader clamps to a floor, so the derived key no longer matches -> rejects
    // (and, symmetrically, iter=9e9 can't hang the tab). It completes fast.
    const tampered = { ...env, iter: 1 };
    await expect(decryptJson(tampered, "passphrase-x")).rejects.toThrow(/passphrase|damaged/i);
  });
});
