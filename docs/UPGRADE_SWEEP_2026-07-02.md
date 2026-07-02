# AppDeck Upgrade Sweep — 2026-07-02

Repo-grounded re-audit of the 2026-06-27 findings at HEAD `f0f2f2b`, plus a six-item upgrade
batch shipped on top. Read `docs/CODE_AUDIT_2026-06-27.md` first for the original findings; this
document records what is now true.

## 1. Verdict

The 06-27 audit docs describe a codebase that no longer exists: **11 of its 15 findings were
already fixed** by the remediation commits (`3201a8e`…`8950679`, `5d2a4ab`, `2da7996`, `f0f2f2b`)
before this sweep began, and the "runtime engines" commits converted most of the cosmetic-stub
tier into real features. Verified at HEAD:

- **Fixed pre-sweep:** recipe URL boundary, server auth-params leak + KEK params, last_url LWW
  clock bump, deep-link queueing, putVault cap + generic 500s, draft releases, permission
  default-deny + check handler, unread-regex guards, badge reconcile, notification prune+dedup,
  LICENSE/engines, per-service window-open guards.
- **Now substantive (was stub):** privacy firewall (real `webRequest` enforcement), peer sync
  (real encrypted HTTP transport), extension packs (real CSS/JS injection), Recipe Studio (real
  fetch-and-analyze), plus the AI inbox features (real provider calls).
- **Still open before this sweep:** synced `custom_js` provenance (#7), data-changed reload
  amplification (#13), e2e/server not in CI (#15), fileSync status honesty (#17), cloudSync
  revision churn, cooperative-only lock (#10 partial), focus modes + portable mode stubs, the
  fabricated "1,500+" catalog claim, and a startup `load()` that hangs forever on any rejection.

## 2. What this sweep shipped (2026-07-02)

1. **Custom-code provenance gate** — closes audit #7, the last HIGH.
   `src/main/services/customCode.ts`: per-instance SHA-256 fingerprint approvals stored in the
   local `meta` table (never in the vault). Local edits via `service:update` auto-approve
   (`src/main/ipc/register.ts`); code arriving via sync/import stays inert until approved
   (`serviceViewManager.injectCustomCode`), with an `event:custom-code-pending` push and an
   approve banner in the service panel (`ProControls.tsx`). Pre-gate code is grandfathered once
   at migrate time. New IPC: `service:pendingCustomCode`, `service:approveCustomCode`.
2. **Main-process lock gating** — closes audit #10.
   `ServiceViewManager` takes an `isLocked` provider; `setBounds` and `attach` hard-refuse while
   locked, so no IPC call can re-show live panes over the lock screen.
3. **Focus modes are real** — closes the flagship stub.
   `focusModes.ts` gained `activeFocusMode` / `focusNotificationDecision` /
   `focusSleepIdleOverride` (workspace-scoped; blockedServiceIds > allowedServiceIds >
   muteNotifications). `NotificationService.shouldNotify` and `SleepManager.tick` now enforce
   them. Bonus fix: an explicit `idleMinutes: null` ("never sleep") was silently coerced to the
   30-minute default by `??` — never-sleep now works and beats focus overrides.
4. **Sync trust pack.**
   cloudSync: content-hash convergence guard (no more revision churn on no-op syncs),
   single-flight `syncNow`, `lastSyncAt`/`lastError` in status. fileSync: single-flight +
   surfaced `lastError`; the hardcoded `pendingConflicts: 0` UI lie is gone (LWW never reports
   conflicts by design). The sync panel now shows real health.
5. **Honest catalog + peer-sync serve fix.**
   `registrySeed.ts` v2 seeds one row per real app (88) instead of 88×18 name variants;
   version-gated reseed prunes legacy synthetic rows unless a service references them.
   README/UI claims updated. Also: `peer_sync_serve` was missing from the `settings:set` zod
   enum, so the peer share server could never be enabled — added, with an explicit opt-in toggle
   in the Peer Sync panel.
6. **Renderer resilience + CI.**
   `appStore.load()` failures now render a retry screen instead of hanging the splash forever;
   top-level `ErrorBoundary`; `event:data-changed` reloads debounced (150 ms);
   service-affecting shortcuts (Ctrl+T/R/W/1-9/Tab) no longer fire while typing in a field.
   CI gained a `server` job (`tsc --noEmit` on the Worker).

Tests: 15 files/32 tests at audit time → **31 files / 79 unit tests + 3 e2e** now. New suites:
`focusEnforcement`, `customCode`, `serviceViewGuards` (Electron-mocked ServiceViewManager),
`syncRobustness`.

## 3. Remaining backlog (ranked)

| Pri | Item | Evidence / notes |
|-----|------|------------------|
| P1 | Server rate limiting (signup/login) | `server/src/index.ts` — putVault is capped but signup/login are unthrottled; needs a Cloudflare rate-limit rule or KV/DO window. Document as a required deploy step. |
| P1 | Code signing + notarization before public release | `electron-builder.yml` supports CSC_* env; unsigned builds train users to click through SmartScreen. Competitor gap: Ferdium ships under a personal cert. |
| P2 | e2e job in CI | `test:e2e` passes locally; wire xvfb/windows runner into `.github/workflows/ci.yml`. |
| P2 | Automations `runAiPrompt` action | Schema advertises it (`ipc-contract.ts` automationActionSchema) but `automationRuntime.executeAction` doesn't implement it — inject AiService. |
| P2 | Portable mode is still a stub | `portableMode.ts` stores `portable_mode_root` that nothing reads. Wire export/vault defaults to it or remove the panel. |
| P2 | ProControls per-panel data laziness | ~20 eager IPC calls on open (`ProControls.tsx` effect); split panels into files with their own loaders. |
| P3 | Focus mode `hideMutedServices` | Stored but not consumed by ServiceRail; smallest remaining focus gap. |
| P3 | Light-theme hardcoded colors | `text-red-300`, priority dots (`InboxPanel.tsx`), color fallbacks — define semantic CSS vars. |
| P3 | Token revocation for cloud sync | Stateless 30-day HMAC tokens can't be revoked server-side. |
| P3 | Tombstone-TTL resurrection edge | Documented v1 LWW behavior (`merge.ts`); needs version vectors if it ever bites. |

## 4. Competitive positioning notes (July 2026)

Wavebox free = 2 spaces × 2×2 apps ($99/yr for more); Rambox free = 2 instances/app, workspaces
paid ($70/yr); Franz 6 = 3 services free, BYO-AI paid ($60/yr); Shift = 5 spaces free
($199.99/yr); Sidekick dead, Station zombie, Arc frozen. AppDeck's wedge is real: unlimited
everything + free E2EE self-hostable sync + free BYO AI (incl. local) + per-app
proxy/UA/JS-CSS — each of those is a paid tier somewhere else. The category's #1 complaint is
Electron RAM; AppDeck's sleep + hidden-view trim + metrics panel is the right answer — keep
investing there. The catalog honesty fix matters because fabricated counts are exactly what
HN/Reddit reviewers punish.
