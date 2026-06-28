# AppDeck Remediation Plan (for an autonomous coding agent)

This plan fixes the confirmed high-severity findings from `docs/CODE_AUDIT_2026-06-27.md`. Each task is
self-contained: goal, why, exact files, step-by-step changes, tests to add, and a definition of done.
Read `docs/CODE_AUDIT_2026-06-27.md` for full context before starting.

## Operating rules

- **Stack:** Electron 42 + React 18 + TypeScript (electron-vite), better-sqlite3, libsodium-wrappers-sumo,
  zod, zustand. Server is a Cloudflare Worker + D1 in `server/`.
- **Work on a branch:** `git checkout -b fix/audit-2026-06-27`. Commit after each task with a clear message.
  **Do NOT push or merge** — stop after the final verification and leave the branch for human review.
- **TDD:** for every behavioral change, add or extend a test under `tests/unit/` FIRST (write it failing),
  then implement until green. Existing test files to extend are named per module
  (`crypto.test.ts`, `merge.test.ts`, `recipeRegistry.test.ts`, `sync.test.ts`, etc.).
- **Verification chain (must pass before you call any task done):**
  ```
  npm install            # if node_modules is absent
  npm run typecheck      # tsc x2, must exit 0
  npm run lint           # eslint, must exit 0
  npm test               # vitest (rebuilds better-sqlite3 first), must be all-green
  ```
  The repo is currently fully green on all three — keep it that way. Do not weaken eslint/tsconfig.
- **Scope discipline:** do not refactor unrelated code, do not add dependencies, do not touch
  `node_modules/`, `out/`, `out-tsc/`, `build/`, `dist/`. Keep diffs minimal and reviewable.
- **Style:** match surrounding code (the codebase has 0 `any`, 0 `@ts-ignore`, strict null checks — keep it so).

Do the tasks in order. Tasks 1–4 are the required P0/P1 fixes. Task 5 is an optional P2 batch.

---

## Task 1 (P0) — Enforce an http(s)-only boundary on all recipe/URL inputs

**Why:** Imported community recipe packs and custom recipes flow into `webContents.loadURL()` with no
scheme check, so a pack can point a service at a `file://` or `data:` URL (local-file disclosure /
script execution in an attacker-controlled origin). The pack import also accepts an attacker-chosen `id`
with `INSERT OR REPLACE`, letting a pack overwrite a trusted `seed-*` registry row. Zod's
`z.string().url()` does **not** restrict scheme — it accepts `file:`/`data:`/`javascript:`.

**Files:**
- `src/shared/ipc-contract.ts`
- `src/main/db/repositories/recipeRegistry.ts`
- `src/main/views/serviceViewManager.ts`

**Steps:**

1. **Add a shared http-only URL guard.** In a suitable shared spot (e.g. top of
   `src/shared/ipc-contract.ts`, exported), add:
   ```ts
   export function isHttpUrl(value: string): boolean {
     try {
       const u = new URL(value);
       return u.protocol === 'http:' || u.protocol === 'https:';
     } catch {
       return false;
     }
   }
   export const httpUrlSchema = z.string().refine(isHttpUrl, { message: 'URL must be http(s)' });
   ```

2. **Use `httpUrlSchema` in the IPC contract** in place of `z.string().url()` everywhere a URL becomes
   navigation: `service:navigate.url` (line ~185), `tab:create.url` (line ~202, keep `.optional()`),
   `recipe:createCustom.start_url` (line ~210), and the `start_url` field inside `customRecipePatchSchema`
   (used by `recipe:updateCustom`). Leave `linkRule:test.url` as-is (it's only matched, never loaded) or
   switch it too for consistency — your call, but do not break the existing `linkRules.test.ts`.

3. **Harden the registry pack import** in `recipeRegistry.ts`:
   - Add a module-local `isHttpUrl` (or import the shared one) and a scheme check in
     `importRecipeRegistryPack`: if `!isHttpUrl(startUrl)`, `skipped += 1; continue;` (mirror the
     existing name/category skip at line ~148).
   - **Namespace the id so a pack can never overwrite a non-community row.** Replace the id derivation
     (line ~152) so the id is ALWAYS `community-`-prefixed and derived from a slug, ignoring any
     attacker-supplied raw id that isn't already community-scoped. Simplest correct form:
     ```ts
     const rawId = stringField(item.id);
     const id = rawId.startsWith('community-') ? rawId : `community-${slug(rawId || name)}`;
     ```
     Keep `INSERT OR REPLACE` — it can now only clobber other `community-` rows.
   - In `validateRecipeRegistryPack`, replace the permissive `isUrl(startUrl)` check (line ~258, ~260)
     with the http-only check so the preview and the import agree on what's valid.

4. **Defense in depth at the load site** in `serviceViewManager.ts`: guard the two places a URL string
   is handed to Chromium so a bad URL can never load even if it reaches the DB another way:
   - In `ensureView()` before `view.webContents.loadURL(startUrl, …)` (line ~295): if
     `!isHttpUrl(startUrl)`, fall back to `resolved.startUrl` (or skip + emit a `crashed`/`ready` state);
     do not load a non-http URL.
   - In `navigate()` (line ~149): if `!isHttpUrl(url)` return without loading.

**Tests (`tests/unit/recipeRegistry.test.ts`):**
- Importing a pack whose entry `start_url` is `file:///etc/passwd` (or `data:text/html,...`) → that entry
  is **skipped**, not stored.
- Importing a pack entry with `id: "seed-whatsapp"` does **not** modify the existing `seed-whatsapp` row;
  the imported row lands under a `community-…` id instead.
- A normal `https://` entry still imports (regression).

**Definition of done:** new tests pass; full verify chain green; no non-http string can reach `loadURL`.

---

## Task 2 (P0) — Close the sync-server auth surface and strengthen the KEK

**Why:** `GET /api/auth-params?email=` returns the passphrase-`wrapped_key` to **anyone, unauthenticated**,
which (a) confirms whether an email has an account (enumeration) and (b) hands out the exact blob needed
to brute-force the passphrase offline. Separately, the Argon2id KEK that protects that blob uses
`OPSLIMIT_MODERATE` (3 passes) but only `MEMLIMIT_INTERACTIVE` (64 MiB) instead of the matching
`MEMLIMIT_MODERATE` (256 MiB), so it's weaker than intended. Both the client (`src/main/sync/`) and
server (`server/src/`) are in this repo, so change the protocol on both sides.

### 2a — Move `wrapped_key` behind authentication; make `auth-params` enumeration-resistant

**Files:** `server/src/index.ts`, `src/main/sync/cloudSync.ts`.

**Server (`server/src/index.ts`):**
1. `authParams()` (line ~58): return **only** `{ authSalt }`. For an **unknown** email, return `200`
   with a *decoy* salt derived deterministically so the response shape and existence signal are uniform —
   e.g. `authSalt = base64url(hmac(emailNormalized, env.TOKEN_SECRET)).slice(0, 24)`. Never 404 here.
2. `login()` (line ~68): on success, return `{ token, wrappedKey }` (fetch `wrapped_key` in the same
   `SELECT` you already do for `auth_hash`). Keep the `401 invalid_credentials` for a missing user or a
   bad hash — this becomes the single failure point, so enumeration via status code is gone.
   - Optional hardening: when the user is missing, still run `timingSafeEqual` against a fixed dummy
     digest so login timing doesn't distinguish unknown-email from wrong-password.
3. `putVault()` (line ~90): reject oversized blobs — if `body.ciphertext.length` exceeds a sane cap
   (e.g. `2_000_000` chars), return `413`. Prevents D1 storage abuse.
4. `fetch()` catch (line ~35): stop echoing `error.message` to clients on 500 — return a generic
   `{ error: 'server_error' }` and `console.error` the detail instead.

**Client (`src/main/sync/cloudSync.ts`):**
5. Update the `login()` flow (lines ~50–68): `auth-params` now yields only `authSalt`; read `wrappedKey`
   from the **login** response instead of from `params`. Concretely: derive `authHash` from
   `params.authSalt`, POST `/api/login`, then `const { token, wrappedKey } = await loginRes.json()` and
   `unwrapRootKey(JSON.parse(wrappedKey), password)`. Update the `AuthParams` interface to
   `{ authSalt: string }` and add the `wrappedKey` to the login response type. The `signup()` flow is
   unchanged.

> Note: this is a breaking protocol change. At v0.1.0 with no production users that's fine; if a test
> account exists on a deployed worker, re-signup after deploying both sides.

### 2b — Strengthen and future-proof the Argon2id KEK

**File:** `src/main/sync/crypto.ts` (and `WrappedRootKey` in the same file).

1. Make `deriveKek` accept optional params and default the memory to MODERATE:
   ```ts
   export async function deriveKek(passphrase, salt, opslimit?, memlimit?) {
     const s = await sodiumReady();
     return s.crypto_pwhash(
       32, passphrase, salt,
       opslimit ?? s.crypto_pwhash_OPSLIMIT_MODERATE,
       memlimit ?? s.crypto_pwhash_MEMLIMIT_MODERATE,   // was MEMLIMIT_INTERACTIVE
       s.crypto_pwhash_ALG_DEFAULT
     );
   }
   ```
2. **Persist the params in the wrap so future tuning can't brick old vaults.** Extend `WrappedRootKey`
   with `opslimit: number; memlimit: number`. In `wrapRootKey`, write the concrete numbers you used
   (`s.crypto_pwhash_OPSLIMIT_MODERATE`, `s.crypto_pwhash_MEMLIMIT_MODERATE`). In `unwrapRootKey`, pass
   `wrapped.opslimit`/`wrapped.memlimit` into `deriveKek`, **defaulting to the legacy pair**
   (`OPSLIMIT_MODERATE` + `MEMLIMIT_INTERACTIVE`) when the fields are absent, so any already-wrapped
   vault from the previous format still opens.
3. `deriveAuthHash` continues to call `deriveKek` with the new defaults — fine (auth always uses current
   params). Note the pre-release break as above.

**Tests (`tests/unit/crypto.test.ts`):**
- `wrapRootKey` → `unwrapRootKey` round-trips and the wrapped blob now carries `opslimit`/`memlimit`.
- A legacy wrapped blob (object without `opslimit`/`memlimit`, wrapped using the legacy pair) still
  unwraps via the defaults. (Construct it by calling the underlying `crypto_pwhash` with the legacy pair,
  or temporarily wrap with legacy params, then strip the fields.)
- `deriveAuthHash` is deterministic for a fixed `(passphrase, salt)`.

> The server has no JS test harness today. A minimal `vitest` test for `authParams`/`login` shape using a
> fake `D1Database` is a nice-to-have, not required. At minimum, manually reason through the new flow.

**Definition of done:** client login still works against the new server contract (trace it end-to-end);
`auth-params` never returns `wrappedKey` and never 404s; crypto tests green; full verify chain green.

---

## Task 3 (P1) — Stop `last_url` navigation from winning sync merges (silent data loss)

**Why:** `setServiceLastUrl` bumps `updated_at`/`rev`/`origin_device` on every in-page navigation. Because
the merge uses `updated_at` as the last-writer-wins clock for the whole `service_instances` record, the
device you happen to be *browsing* on overwrites real config edits (display name, custom CSS, proxy, …)
made on another device. `last_url` itself is not even synced (it's in the vault denylist), so its clock
bump is pure collateral damage.

**Files:** `src/main/db/repositories/serviceInstances.ts`, `src/main/views/serviceViewManager.ts`.

**Steps:**
1. In `setServiceLastUrl` (line ~183) change the write so it does **not** advance the sync clock:
   ```ts
   db.prepare('UPDATE service_instances SET last_url = ? WHERE id = ?').run(lastUrl, id);
   ```
   Drop the now-unused `deviceId` parameter (and `Date.now()`), and update the single call site in
   `serviceViewManager.ts` `persist()` accordingly (it currently passes `this.deviceId`).
2. Confirm nothing else relies on `setServiceLastUrl` bumping `updated_at` (it isn't wired to
   `sendDataChanged`/sync triggers — navigation persistence is local-only, so this is safe).

**Tests (`tests/unit/merge.test.ts` or a new `serviceInstances.test.ts`):**
- Create a service instance, capture its `updated_at`/`rev`, call `setServiceLastUrl`, re-read: `last_url`
  changed but `updated_at` and `rev` are unchanged.
- (Merge-level, if convenient) Device B edits `display_name` (bumps clock); Device A only navigates
  (`last_url`); after a merge the edited `display_name` survives.

**Definition of done:** new test proves no clock bump on navigation; verify chain green.

---

## Task 4 (P1) — Deliver deep links to sleeping/not-yet-created services

**Why:** `LinkRouter.routeTo` calls `wake()` then `navigate()` then `focus()`. But `wake()` only emits a
`loading` state — it does not create the `WebContentsView`; `navigate()` no-ops because there is no live
view; and when the renderer later recreates the view on the next bounds sync, `ensureView()` loads the
*stale* `last_url`/tab url, not the deep-link target. Since services sleep by default (~30 min idle),
this is the common case — the link-routing feature silently drops the destination.

**Files:** `src/main/views/serviceViewManager.ts`, `src/main/services/linkRouter.ts`.

**Steps (use a pending-navigation handoff consumed at view creation):**
1. In `ServiceViewManager` add `private readonly pendingNavigate = new Map<string, string>();`
2. Add a method that prefers a live view but falls back to queuing for the next creation:
   ```ts
   routeNavigate(instanceId: string, url: string): void {
     const contents = this.contentsFor(instanceId);
     if (contents) { void contents.loadURL(url); return; }
     this.pendingNavigate.set(instanceId, url);   // consumed by ensureView
     this.wake(instanceId);                        // flips slot state so the renderer recreates the view
   }
   ```
3. In `ensureView()`, when computing `startUrl` (line ~261), let a pending target win and clear it:
   ```ts
   const pending = this.pendingNavigate.get(instance.id);
   if (pending) this.pendingNavigate.delete(instance.id);
   const startUrl = pending ?? tab?.url ?? instance.last_url ?? resolved.startUrl;
   ```
   (Validate `pending` with the Task 1 `isHttpUrl` guard for safety.)
4. In `LinkRouter.routeTo` (line ~46) replace the `wake()` + `navigate()` pair with a single
   `this.viewManager.routeNavigate(instanceId, target); this.viewManager.focus(instanceId);`

**Tests:** add a focused `tests/unit/linkRouter.test.ts` (a new file). Because routing touches Electron
`WebContentsView`, test against a **fake** `ServiceViewManager` (an object capturing `routeNavigate`
calls) to assert that routing a URL matching an instance's `allowedDomains` calls
`routeNavigate(instanceId, target)` with the exact target, and an unmatched URL opens externally. Use the
real `linkRules`/`serviceInstances` repos against an in-memory test DB (see `tests/unit/helpers.ts`
`createTestDb`). Keep it deterministic; do not boot Electron.

**Definition of done:** routing a deep link to a sleeping service results in a `routeNavigate(id, target)`
call carrying the destination; verify chain green.

---

## Task 5 (P2, optional batch) — Quick robustness & UX wins

Do these only after Tasks 1–4 are green. Each is small and independent; commit separately. Skip any that
prove more involved than a focused change.

1. **Clear badge on service delete.** In `service:delete` (`src/main/ipc/register.ts:230`) call
   `ctx.badgeService.clear(input.id)`. On startup, reconcile the badge map against live instances.
   (`src/main/services/badges.ts:20`.)
2. **Add a permission *check* handler.** In `serviceViewManager.configureSession` add
   `partition.setPermissionCheckHandler(...)` mirroring `permissionDecision`, and change the
   `setPermissionRequestHandler` default so `media` prompts/denies rather than auto-allowing
   (`serviceViewManager.ts:301-313`). Default unknown permissions to deny.
3. **Guard recipe `unread` regexes.** In `src/preload/service-preload.ts` wrap each `new RegExp(...)`
   (lines ~92, ~103) in `try/catch`, and cap the input/pattern length. Optionally validate the regex in
   the import path. Prevents a poisoned recipe from pinning a CPU core or killing unread counts.
4. **Lock-gate the view layer.** Hard-block `setBounds`/`attach` in `ServiceViewManager` while the app is
   locked (track a `locked` flag set from `AppLockService`), so a stray `view:setBounds` can't re-show
   live content over the lock screen (`serviceViewManager.ts:191`, `appLock.ts`).
5. **Prune + dedup notifications.** Run `pruneOldNotifications` on an interval (not just at startup,
   `index.ts:119`) and dedup inserts on `(instance_id, title, body)` within a short window
   (`src/main/services/notifications.ts`).
6. **Debounce the data-changed reload.** In `src/renderer/App.tsx` (~line 51) debounce the
   `event:data-changed` → `load()` handler ~100–150 ms and add a request-id guard in `appStore.load`
   so overlapping reloads can't flip the UI.
7. **CommandPalette accessibility.** In `src/renderer/components/CommandPalette.tsx` add arrow/Enter/Escape
   keyboard navigation, `role="dialog"`/`role="listbox"`, and aria labels; add a shared Escape-to-close +
   focus trap usable by the other overlays.
8. **Add a `LICENSE` file** (MIT, matching `package.json`) and an `engines` field
   (`"node": ">=20"` or whatever CI uses). Align `RELEASING.md` with `electron-builder.yml`
   (the doc says "draft" but the config publishes immediately — pick one).

---

## Final verification & handoff

1. Run the full chain once more and paste the output into your summary:
   ```
   npm run typecheck && npm run lint && npm test
   ```
   (Optionally `npm run build` to confirm the production bundle compiles.)
2. Summarize per task: what changed, files touched, tests added, and the green verify output.
3. Leave the branch `fix/audit-2026-06-27` committed but **unpushed** for human review. Do not merge.

If any task can't be completed safely within these constraints, stop, leave that task's changes out, and
report exactly what blocked you rather than weakening tests, types, or lint to force a pass.
