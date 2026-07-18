# Transfer & Publish Contracts

Accountless, secret-free sharing (Theme 4) + native packaging (Theme 8). All paths are
offline-capable and introduce no backend.

## T1 — Device-to-device transfer (FR-014, SC-005)

**Primary — portable file**
- Given a library → When the user chooses "Share / transfer" → Then the app produces the
  single portable JSON file and hands it to the OS share sheet (native) or downloads it
  (web). No account, no secret.
- Given a received file → When imported on another device → Then it runs the **identical**
  validate + sanitize path (never executed) and merges/restores per existing import rules.

**Convenience — QR (small libraries)**
- Given a small library → When "Show QR" → Then the app encodes the portable JSON
  (photos excluded or compressed) into a QR rendered fully offline.
- Given the other device → When it scans the QR → Then it imports via the same validation
  path.
- Given the payload exceeds safe single-QR capacity → When the user opens QR → Then the UI
  explains and switches to the file hand-off (no silent failure, no truncation).

**Guarantees**: no credential is ever part of a transfer; nothing leaves the device except
by this explicit user action; a transfer can never import executable content.

## T2 — One-button publish → drag-to-host (FR-015/016/017, SC-006/009)

- Given a journal/trip → When the user taps **Publish** → Then the app emits **one
  self-contained `.html`** (all CSS/JS/data/photos inlined; **zero** external requests) and
  offers save/share + terse instructions: "drag onto netlify.com/drop (no login), send the
  link."
- Given the published file → When opened by a recipient **offline** → Then it renders fully
  (self-containment asserted: no `http(s)://`/`ws(s)://` references; existing e2e).
- Given Settings → When a non-technical user reads sharing → Then QR/file + one-button
  publish are prominent; **GitHub PAT sync is behind an "Advanced" disclosure**.
- Given GitHub is never configured → When the user does anything (log/browse/journal/
  publish/transfer) → Then nothing is blocked (SC-009).
- **No OAuth / no proxy / no backend** anywhere in this path (FR-018).

## T3 — Native app (Capacitor) (FR-032/033, SC-011)

- Given the one web codebase → When wrapped by Capacitor → Then it builds+runs as Android
  (now) and iOS (same codebase) apps.
- Given the native app → When data is written → Then it persists across app restart and
  update in durable on-device storage (WebView IndexedDB + periodic file backup).
- Given the native shell → When used → Then status bar, safe-area insets, keyboard handling,
  and haptics on primary actions are present; offline-first is identical to the PWA.

## Reference (existing, must not regress)

- Portable file schema + import validation/sanitization (Zod) — the transfer/restore payload.
- `renderReader` self-contained site — the publish output; its self-containment test stays
  green.
