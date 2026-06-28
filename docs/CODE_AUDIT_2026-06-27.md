# AppDeck Engineering Audit — 2026-06-27

Method: 8-dimension multi-agent audit (security, crypto, server, data/IPC, correctness, renderer/UX,
architecture/feature-authenticity, build/tests/distribution). Every high/critical finding was
independently **adversarially verified** (a second agent tried to refute it against the code).
Empirical baseline at audit time: `typecheck` ✓, `lint` ✓, `vitest` ✓ (15 files / 32 tests).

Totals (pre-verification): 11 high, 17 medium, 14 low, 3 info = 45 findings. After verification,
6 highs were confirmed at high severity; 5 were confirmed-but-downgraded to medium.

---

## 1. Verdict

For a v0.1.0, ~1-day-old single-developer Electron app, AppDeck is **unusually well-built and
security-conscious**. The hard Electron boundary is genuinely sound — `sandbox` + `contextIsolation`
on and `nodeIntegration` off everywhere, strict packaged CSP, a real preload channel allowlist,
zod-validated IPC, *correct* dotted-suffix host matching (no `evil.com.allowed.com` bypass), per-service
Chromium partitions. Crypto primitives are modern and correctly used (Argon2id + XChaCha20-Poly1305,
192-bit random nonces, AAD binding, constant-time compares, sound domain separation between the
server auth-hash and the key-wrapping KEK). The sync server is honestly zero-knowledge. Build/test
scaffolding (cross-OS CI matrix, strict TS, `no-floating-promises`) is well beyond what's typical at
this age. Type safety is exceptional: **0 `any`, 0 `@ts-ignore`, 0 genuine `!` assertions.**

The real problems cluster at two trust boundaries plus one credibility gap:
1. **Untrusted recipe/registry data becomes navigation and trust-graph mutation without validation.**
2. **The public sync server hands the root-key-wrapping blob to anyone unauthenticated**, and the
   Argon2id KEK protecting it is mis-parameterized (3 passes but only the 64 MiB *interactive* memory
   floor), making that blob cheaper to crack than intended.
3. **The "beyond-parity" feature tier is partly theater** — ~25% of the flashy advertised features are
   cosmetic stubs that store config nothing enforces, and the "1,500+ recipe registry" is a fabricated
   count (88 apps × 18 label variants; only 40 hand-authored).

None are remote zero-click against a default install, but several break the *stated* model and should
be fixed before any public release.

---

## 2. Top fixes, prioritized

Severities reflect the adversarial verifier's adjusted severity. `↓` = verifier downgraded from high.

| # | Pri | Title | Sev | Where | Why it matters | Fix |
|---|-----|-------|-----|-------|----------------|-----|
| 1 | **P0** | Recipe/registry `start_url` reaches `loadURL` with no scheme check; import can overwrite `seed-*` recipes | high | `serviceViewManager.ts:295`; `recipeRegistry.ts:128,152`; `ipc-contract.ts:185,210,224` | Imported community pack can point "Gmail" at an attacker origin, widen its own nav allowlist, or load `file://`/`data:` — breaks the untrusted-recipe boundary | Reject non-`http(s)` before every `loadURL`; force a `community-` id prefix (never accept the pack's `id`); replace `z.string().url()` with a protocol-asserting refinement at all 3 IPC sites + `merge.ts` |
| 2 | **P0** | Unauthenticated `/api/auth-params` leaks `wrapped_key`; KEK under-parameterized | high | `server/src/index.ts:58-66`; `crypto.ts:31-38` | Anyone who knows an email gets the offline-crackable root-key blob; KEK uses 64 MiB interactive floor, not 256 MiB moderate | Return only `auth_salt` (uniform shape for unknown emails); deliver `wrapped_key` only after `/api/login`; raise KEK to `MEMLIMIT_MODERATE`/`SENSITIVE` **and persist ops/mem params in the wrap** so it stays upgradable |
| 3 | **P1** | Browsing device wins LWW merge and overwrites real config edits | high | `serviceInstances.ts:189-191`; `vault.ts:98`; `merge.ts:46-49` | `last_url` navigation bumps `updated_at` though it isn't synced, so the device you browse on clobbers the other device's edits — **silent data loss in normal 2-device use** | Don't advance the LWW clock for non-synced fields: move `last_url` to a local-only table, or write it without bumping `updated_at`/`rev` |
| 4 | **P1** | Deep link to a sleeping/uncreated service silently drops the target URL | high | `linkRouter.ts:46`; `serviceViewManager.ts:149,186,261` | `wake()` doesn't create the view, `navigate()` no-ops, recreated view loads stale `last_url` — the deep-link feature fails in its **default (30-min sleep) state** | Persist a per-instance `pendingNavigate` consumed by `ensureView()`, or `setServiceLastUrl(target)` before `wake()`; add a regression test |
| 5 | **P1** | No rate limiting on any server endpoint | med ↓ | `server/src/index.ts:25-39` | Unbounded signup (D1 exhaustion), online login guessing, email enumeration + `wrapped_key` harvesting | Cloudflare Rate Limiting rule or KV/DO sliding window keyed on `cf-connecting-ip` + normalized email; document as a required deploy step |
| 6 | **P1** | Windows installer unsigned; auto-update has no signature gate | med ↓ | `electron-builder.yml:12`; `updater.ts:20` | A leaked publish PAT = silent code push to every client; SmartScreen trains users to click through | Authenticode signing (activates electron-updater `publisherName` check) + macOS notarization before first public release; scope/rotate the PAT |
| 7 | **P2** | Synced `custom_js` executes in each page's MAIN world with no provenance gate | med | `serviceViewManager.ts:419-424`; `merge.ts:177`; `vault.ts:113` | One rogue paired device or malicious imported vault pushes JS that auto-runs against every logged-in session on every device | Treat as code: per-instance opt-in not auto-set by sync, UI indicator, consider excluding from sync until re-approved locally |
| 8 | **P2** | Media auto-allowed; no `setPermissionCheckHandler` | med | `serviceViewManager.ts:301,311` | Any service page can grab camera/mic silently; the permission-*check* path bypasses policy entirely | Default media to prompt/deny; add `setPermissionCheckHandler` mirroring `permissionDecision`; default-deny unknown perms |
| 9 | **P2** | Recipe `unread` regexes compiled per-mutation, no ReDoS/length guard | med | `service-preload.ts:92,103`; `recipeRegistry.ts:164` | A poisoned recipe can pin a CPU core via catastrophic backtracking, or kill unread counts via an invalid pattern (no try/catch) | `try/catch` the `new RegExp`, cap pattern + input length, validate in the import path |
| 10 | **P2** | App lock is cooperative-only; `view:setBounds` not lock-gated | med | `appLock.ts:53`; `serviceViewManager.ts:191`; `register.ts:286` | Lock only detaches views in the renderer; one stray `setBounds` re-shows live content over the lock screen | Hard-gate `setBounds`/`attach` in main while locked |
| 11 | **P2** | Badge count for deleted service never cleared | med | `badges.ts:20`; `register.ts:230` | Phantom taskbar unread until restart | Call `clear(input.id)` in `service:delete`; reconcile the map against live instances on startup |
| 12 | **P2** | Notifications pruned once at startup; no dedup | med | `index.ts:119`; `register.ts:646` | Resident tray app → unbounded inbox + duplicate OS toasts from PWA re-fires | Prune on an interval; dedup on `(instance_id, title, body)` within a short window |
| 13 | **P2** | `event:data-changed` → full `load()` on every mutation | med ↓ | `App.tsx:51-53`; `appStore.ts:202-263` | 2-3× redundant 11-call refetches per click + transient flicker from overlapping `load()` (self-heals, no corruption) | Debounce the handler ~100-150ms; add a request-id guard; stop double-mutating |
| 14 | **P2** | Accessibility: zero aria/roles, no keyboard nav in CommandPalette, no Escape-to-close | med ↓ | `CommandPalette.tsx:29-94`; `LockScreen.tsx:25` | Keyboard/screen-reader users locked out | Arrow/Enter/Escape + `role=dialog`/`listbox`; shared Escape-to-close + focus trap; aria-labels |
| 15 | **P2** | High-risk modules untested; e2e + server not in CI | med ↓ | `register.ts`, `serviceViewManager.ts`, `server/src/index.ts`, `linkRouter.ts`, `migrate.ts` | Partition isolation, IPC validation, server auth, link routing have no regression net | Add tests for those modules; add a server-typecheck CI job + an e2e job; test the **incremental** migration path |

### Verifier refutations / corrections (checked and softened)

- **Notification-shim spoof is send-only.** A frame can fabricate notifications attributed to its *own*
  service but **cannot read** other services' notifications, and the inbox renders title/body as plain
  text (no XSS). Worth a source check, but low impact.
- **`loadURL('javascript:...')` is a no-op** in modern Electron, and a `data:` page gets an *opaque
  origin* so it cannot read the partition's existing https cookies. The real teeth of finding #1 are
  `data:` script execution in its own origin and `file://` local-file disclosure.
- **Seed-overwrite poisons the DB-backed seed catalog entry**, not the hardcoded in-memory builtin
  (which wins precedence in `RecipeLoader`). Instances created from a seed entry still resolve the
  poisoned row, so the finding stands — but the nuance matters.
- **`migrate.ts` is not zero-coverage**: the empty→forward path runs in every repo test via
  `createTestDb`. What's genuinely untested is the **incremental upgrade-with-existing-rows** path.
- **The `load()` race does not corrupt durable state** — all mutations commit to SQLite before any
  `load()` reads, so the UI converges. Transient flicker only; hence the downgrade.

---

## 3. Feature authenticity — real engine, padded spec sheet

Of ~12+ flashy advertised features traced end-to-end (IPC → repo/service → *does anything consume the
stored data at runtime?*): **~58% substantive, ~17% partial, ~25% cosmetic stub.** The original product
is real; the newest "beyond-parity" marketing tier is the stub layer. The tell they share: a
`*:test` / `*:status` IPC handler that lets the UI *preview* an effect that is never actually applied.

| Feature | Verdict | Decisive evidence |
|---|---|---|
| Privacy firewall | **COSMETIC STUB** | `testFirewallRules` is called only from `firewall:test` (`register.ts:521`); never from any `onBeforeRequest`/`webRequest` hook. Nothing enforces a firewall rule on a real request. |
| Automations | **COSMETIC STUB** | `testAutomation` called only from `automation:test`; `markAutomationRun` (`automations.ts:82`) is **dead code**. No trigger loop exists — rules can be defined and "tested" but never fire. |
| Smart focus modes | **COSMETIC STUB** | `NotificationService.shouldNotify` reads `workspace.focus_rules`, not the `focus_modes` table (`notifications.ts:43-51`). The standalone feature computes an "active mode" for the UI but mutes nothing. |
| Peer sync | **COSMETIC STUB** | Pure CRUD on `peer_sync_peers`; `peerSync:status` returns a hardcoded hint referencing a *"future AppDeck peer endpoint"* (`register.ts:561-562`). No network code reads the list. |
| Portable mode | **COSMETIC STUB** | Stores two settings keys; notes admit it keeps *"future exports"* under a root. Nothing reads `portable_mode_root`. |
| Extension packs | **COSMETIC STUB** | Writes one meta row `extension_pack_<id>=true` (`extensionPack.ts:64`) from a hardcoded 6-template list; that key is never read anywhere. |
| "1,500+ recipe registry" | **INFLATED** | 88 apps × 18 cosmetic name-variant suffixes = 1,584 generated rows (`registrySeed.ts:110-153`), all 18 variants pointing at the same URL. Hand-authored builtin set is **40**. |
| Recipe Studio | **PARTIAL** | `createRecipeFromStudio` writes a real recipe, but `analyzeRecipeDraft` returns canned suggestions regardless of input (`recipeStudio.ts:21-22`). |
| Personal analytics | **SUBSTANTIVE** | Aggregates real notification/task/service rows + `app.getAppMetrics()`. |
| Dashboards / snapshot | **SUBSTANTIVE** | Pulls real tasks/notifications/downloads/shortcuts/sessions. |
| Work-kit apply | **SUBSTANTIVE** | Actually creates workspace + recipes + service instances + AI prompts + focus mode. |
| Workspace snapshots | **SUBSTANTIVE** | Re-applies saved layout + per-service flags on restore. |
| BYO AI | **SUBSTANTIVE** | Real HTTP to 4 providers (Anthropic SDK, OpenAI-compat, Ollama, Gemini); key encrypted via `safeStorage`. |
| Tracker/ad blocking | **SUBSTANTIVE** | Real `onBeforeRequest` cancel + stats, applied per partition. |
| Permissions / proxy / downloads | **SUBSTANTIVE** | Real per-partition permission handler, proxy, and `will-download` recording. |
| Link routing | **SUBSTANTIVE** | Wired to OS deep-links; routes into the matching pane (buggy per #4 but real). |
| Migration / browser / Ferdium import | **SUBSTANTIVE** | All parse real formats and create live panes. |

**Fastest credibility win:** for each of the six stub features, either wire the `*:test`/`*:status`
preview to a real effect, or remove the feature from the UI/README until it's wired. And drop the
"1,500+" claim (or make the variants meaningfully distinct).

---

## 4. By theme (selected detail)

**Security & Electron hardening.** Core is solid. Weaknesses are all where imported/synced data becomes
navigation or code: recipe `start_url` → `loadURL` with no scheme check (#1), media auto-allow + no
permission-check handler (#8), synced `custom_js` in MAIN world (#7), spoofable notification shim
(low, send-only), Chrome extensions loaded from arbitrary paths with `allowFileAccess:true` (low,
deliberate + not synced). Main window has no `setWindowOpenHandler`/`will-navigate` guard — info-only
while it loads trusted local content under strict CSP.

**Crypto & E2EE sync.** Primitives well-chosen; domain separation sound. Issues: KEK
`OPSLIMIT_MODERATE` (3) with `MEMLIMIT_INTERACTIVE` (64 MiB) instead of matching 256 MiB moderate
(`crypto.ts:31-38`), and the chosen params aren't persisted with the wrap so future hardening would
brick old vaults. Root key persisted via `safeStorage`, never zeroized (worth documenting given the
E2EE framing). Sync correctness: classic tombstone-TTL resurrection risk + a missing convergence guard
in `cloudSync` that churns server revisions even when nothing changed (`cloudSync.ts:77-109`).

**Sync server.** Correctly zero-knowledge; parameterized D1; constant-time compares. Gaps: unauth
`auth-params` leak + enumeration (#2/#5), no rate limiting (#5), unbounded `putVault` ciphertext → D1
abuse (`index.ts:90-111`), stateless 30-day token with no revocation, 500s echo `error.message`, no
email verification. CORS absence is correct (legitimate client is Node-land).

**Data & IPC.** Strong baseline: bound `?` params throughout, `searchNotifications` escapes LIKE with
`ESCAPE '\'`, transactional version-gated migrations, all IPC centralized + zod-validated. The hole is
the community-pack import path (#1) bypassing the zod contract (attacker-chosen `id` +
`INSERT OR REPLACE`, no URL validation, `unread_spec` passed through unvalidated, #9). The `dashboard:upsert`
`widgets as never` cast (`register.ts:376`) papers over a real schema↔domain divergence.

**Correctness & leaks.** Lifecycle generally clean (timers unref'd, dispose paths exist, download
listeners scoped per-WebContents). Real bugs: deep-link target loss (#4), phantom badge (#11),
unbounded inbox + duplicate toasts (#12), cooperative-only lock (#10). Lower: debounced sync rejections
swallowed with `.catch(()=>undefined)` and `pendingConflicts` hardcoded to 0 (`fileSync.ts:52,132`);
no single-flight guard on `syncNow`.

**Renderer & UX.** Genuinely good hygiene: every push subscription torn down in cleanup, all DOM
listeners/observers cleaned up, `view:setBounds` is rAF-coalesced, stable list keys. Faults:
data-changed amplification (#13), zero accessibility (#14), unwrapped IPC calls + no error boundary
(a rejected `invoke` silently no-ops; a failed startup `load()` hangs on the splash forever —
`client.ts:66-68`, `main.tsx:6-10`), global Ctrl+K/Ctrl+T firing while typing in inputs
(`App.tsx:62-75`).

**Architecture.** ProControls.tsx is a 3,564-line god-component: **28 inline feature panels, 27
`useState` in the parent, 20 IPC round-trips eagerly fired on open** regardless of active panel
(`ProControls.tsx:134-157`). Split each `*Panel` into its own file, make data-loading lazy per panel
(kills the thundering herd), keep ProControls as a thin shell with a lazy panel registry. Repository
layer is ~45-55% boilerplate across two divergent CRUD templates, with the sync-table column lists
**triplicated** (repo create + repo update + `merge.ts` hand-rolled upsert) — that triplication is
where sync bugs hide, and it masks a real gap: only 6 tables actually sync, so `automations`,
`focusModes`, `linkRules`, `shortcuts` look syncable but silently aren't. Module boundaries are clean
(textbook 3-layer Electron separation, zero violations). Dead exports: `markAutomationRun`, `boolInt`,
`deleteMeta`.

**Build/Tests/Distribution.** Above-age scaffolding. Gaps: unsigned build + auto-update (#6); coverage
skewed to safe leaf logic, security-critical modules untested, neither e2e nor server run in CI (#15);
`RELEASING.md` says "draft" but config publishes immediately (`electron-builder.yml:36` +
`--publish always`); declared-MIT but **no `LICENSE` file** and no `engines` field; native better-sqlite3
ABI handling is correct but fragile (switching between `npm test` and `npm run dist` without the
intervening rebuild ships the wrong ABI).

---

## 5. What's genuinely good

- Electron hardening done right (sandbox + isolation + nodeIntegration:off everywhere, strict CSP,
  real preload allowlist, *correct* host matching).
- Modern, correctly-used crypto with sound auth-hash/KEK domain separation.
- Honestly zero-knowledge server.
- Clean data layer: bound params, LIKE escaping, transactional version-gated migrations, fully
  zod-validated IPC.
- Disciplined renderer: every subscription/listener/observer cleaned up, rAF-coalesced native-view
  repositioning, stable keys.
- Exceptional type safety: 0 `any`, 0 `@ts-ignore`, 0 genuine `!`, `noUncheckedIndexedAccess` on.
- Real cross-OS CI matrix and a clean `.gitignore` (no secrets/vault files/artifacts tracked).

---

## 6. Suggested roadmap

1. **Close the recipe/registry navigation boundary (#1).** One shared `isHttpUrl` guard before every
   `loadURL`/`service:navigate`; force a `community-` id prefix on import; protocol-asserting zod
   refinement at all IPC sites + `merge.ts`. Highest-leverage security fix.
2. **Fix the server auth surface (#2, #5).** Return only `auth_salt` from `auth-params` (uniform shape),
   move `wrapped_key` behind `/api/login`, add Cloudflare rate limiting, raise the KEK to
   moderate/sensitive memory **while persisting the KDF params in the wrap**.
3. **Stop the silent data loss + feature failure (#3, #4).** Make `last_url` local-only; persist a
   `pendingNavigate` so deep links to sleeping services land on target. Add the two regression tests.
4. **Gate distribution before any public release (#6 + the `RELEASING.md` mismatch).** Authenticode
   signing + macOS notarization, scope/rotate the publish PAT, align the release config/doc, add a
   `LICENSE` file.
5. **Treat `custom_js` as code and tighten permissions (#7, #8).** Opt-in not auto-set by sync, UI
   indicator, `setPermissionCheckHandler`, default media to prompt.
6. **Honesty pass on the feature surface (§3).** Wire or remove the six stub features; drop/justify
   the "1,500+" claim. Make the sync-coverage set match what the UI implies (sync automations/
   focusModes/linkRules/shortcuts, or stop pretending they sync).
7. **Add a regression net for the dangerous modules (#15)** and wire server-typecheck + e2e into CI.
8. **Refactor ProControls** into per-panel lazy components; collapse the triplicated sync-CRUD into a
   `sync/syncColumns.ts` helper.
9. **Robustness + UX polish (#9-#14):** ReDoS guard on recipe regexes, lock-gate `setBounds`, clear
   badges on delete, interval-prune + dedup notifications, debounce data-changed, top-level error
   boundary + non-hanging `load()`, CommandPalette keyboard nav + Escape-to-close.

Key files: `src/main/views/serviceViewManager.ts`, `src/main/db/repositories/recipeRegistry.ts`,
`src/shared/ipc-contract.ts`, `server/src/index.ts`, `src/main/sync/{crypto,merge,vault,fileSync}.ts`,
`src/main/services/linkRouter.ts`, `electron-builder.yml`, `src/renderer/App.tsx`,
`src/renderer/components/{CommandPalette,ProControls}.tsx`.
