// Zero-knowledge passphrase encryption for a PUBLISHED journal.
//
// A published site is a pile of static files (GitHub Pages, Netlify, a USB
// stick) — there is no server to check a password. So instead of a fake gate we
// ENCRYPT the journal data with a passphrase the visitor types; it is decrypted
// in their browser and the passphrase is never stored in the files. This is the
// only way a password can be genuinely private on static hosting, and it keeps
// the constitution's promise: no server, fully decentralized, data inert at rest.
//
// AES-GCM (authenticated) with a key derived from the passphrase via PBKDF2
// (SHA-256). Everything here uses the standard Web Crypto API — no dependency,
// works in any modern browser and in the reader bundle offline.

/** Self-describing envelope — carries everything the reader needs to decrypt
 *  EXCEPT the passphrase. Safe to publish as a static JSON file. */
export interface EncryptedEnvelope {
  /** Format marker so the reader can detect an encrypted payload vs plain JSON. */
  v: 1;
  alg: "AES-GCM";
  kdf: "PBKDF2-SHA256";
  /** PBKDF2 iteration count (recorded so a future hardening doesn't break old files). */
  iter: number;
  /** base64 salt (16 bytes) and iv (12 bytes). */
  salt: string;
  iv: string;
  /** base64 ciphertext (includes the GCM auth tag). */
  ct: string;
}

// A published envelope is a PUBLIC static file, so cracking is fully offline and
// GPU-parallel — the KDF cost is the whole defence. 600k SHA-256 iterations meets
// current OWASP guidance (was 250k). The count is recorded in `iter` so older
// files still open at their original cost; new files use this.
const ITERATIONS = 600_000;
// Reject a hand-tampered `iter` that would either weaken the KDF to nothing or
// hang the reader's tab for minutes. Bounds the offline work either way.
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
// A short passphrase against any KDF falls in seconds offline — the most likely
// real-world break of a "locked" journal. Enforce a floor in the crypto layer as
// a backstop to the UI's own guard + strength meter.
export const MIN_PASSPHRASE_LENGTH = 8;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Clamp a recorded/user-supplied iteration count into a sane range. */
function clampIterations(iter: unknown): number {
  const n = typeof iter === "number" && Number.isFinite(iter) ? iter : ITERATIONS;
  return Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, Math.round(n)));
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Web Crypto is unavailable — cannot encrypt/decrypt here.");
  return c.subtle;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const s = subtle();
  const baseKey = await s.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return s.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt any JSON-serializable value with a passphrase. */
export async function encryptJson(data: unknown, passphrase: string): Promise<EncryptedEnvelope> {
  if (!passphrase) throw new Error("A passphrase is required to encrypt.");
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ctBuf = await subtle().encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext);
  return {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iter: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ctBuf)),
  };
}

/** Type guard: does this look like one of our encrypted envelopes? */
export function isEncryptedEnvelope(x: unknown): x is EncryptedEnvelope {
  const e = x as EncryptedEnvelope | null;
  return (
    !!e &&
    typeof e === "object" &&
    e.v === 1 &&
    e.alg === "AES-GCM" &&
    typeof e.salt === "string" &&
    typeof e.iv === "string" &&
    typeof e.ct === "string"
  );
}

/** Decrypt an envelope produced by {@link encryptJson}. Throws on a wrong
 *  passphrase or tampered data (GCM authentication fails). */
export async function decryptJson<T = unknown>(env: EncryptedEnvelope, passphrase: string): Promise<T> {
  if (!isEncryptedEnvelope(env)) throw new Error("Not an encrypted Postcards payload.");
  const salt = fromBase64(env.salt);
  const iv = fromBase64(env.iv);
  const ct = fromBase64(env.ct);
  // Clamp the recorded iteration count: a tampered file could set it to 1 (no
  // KDF) or 9e9 (hang the tab). deriveKey then runs bounded work either way.
  const key = await deriveKey(passphrase, salt, clampIterations(env.iter));
  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await subtle().decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
  } catch {
    // GCM tag mismatch — wrong passphrase or corrupted file. Never leak which.
    throw new Error("Wrong passphrase, or the file is damaged.");
  }
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
}
