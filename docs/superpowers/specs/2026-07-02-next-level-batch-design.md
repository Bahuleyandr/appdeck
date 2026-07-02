# Next-Level Batch — Design Spec (2026-07-02)

Approved direction: all five items. Goal: attack the category-wide failures competitors haven't
solved (RAM-vs-notifications tradeoff, notification amnesia, paywalled AI briefings, invisible
memory cost, trust) rather than adding parity features. Grounded against HEAD `ec73788`.

## 1. Doze tier (two-tier sleep)

**Problem.** `ServiceViewManager.sleep()` destroys the `WebContentsView`, so sleeping services
cannot emit notifications and wake with a cold reload. Every competitor has the same tradeoff.

**Design.**
- `SleepPolicy` gains `mode?: 'auto' | 'doze' | 'deep'` (default `auto`) and
  `deepAfterMinutes?: number | null` (default null = never escalate).
- New managed-view state: **dozing** = detached (`removeChildView`) + alive +
  `webContents.setBackgroundThrottling(true)` + `setAudioMuted(true)`. The service preload keeps
  running, so the notification shim still posts `notify:incoming`.
- Tier selection in `SleepManager.tick` when idle threshold passes:
  `deep` → destroy (today's behavior); `doze` → doze; `auto` → doze when the instance is
  unmuted and enabled, deep otherwise. Dozing instances escalate to deep sleep after
  `deepAfterMinutes` more idle minutes when set.
- `trimHiddenViews` becomes tier-aware with the same rule (hidden unmuted views doze instead of
  being destroyed after the 5-minute hidden window).
- Explicit `service:sleep` IPC remains deep sleep (user said sleep, free the RAM).
- Un-doze happens implicitly in `attach()` (bounds sync after the renderer shows the pane):
  unmute audio, mark active. No reload — instant restore.
- New `ServiceState` value `'dozing'`; renderer shows it like sleeping but with a distinct
  tooltip ("Dozing — notifications still arrive"). `event:service-state` payload unchanged.
- `wake()`/`routeNavigate` treat a dozing view as live (contentsFor finds it — no change needed).

**Error handling.** Dozing view crashes follow the existing `render-process-gone` path (it
already ignores destroyed views). Doze on an already-destroyed view is a no-op.

**Tests.** Extend `serviceViewGuards` harness: doze detaches without `close()`, sets
muted+throttled; attach un-dozes and unmutes; sleep still destroys. New `sleepTiering` tests:
auto-tier picks doze for unmuted / deep for muted; `deepAfterMinutes` escalates with injected
clock; never-sleep still wins; notification shim path unaffected (state stays queryable).

## 2. Visible memory accounting

- `ServiceViewManager.processIds(): Array<{ instanceId, pid }>` via
  `webContents.getOSProcessId()` over live (attached or dozing) views.
- `collectMetrics(viewManager?)` gains `services: Array<{ instanceId, displayName, memoryMB,
  state: 'active' | 'dozing' | 'sleeping' }>` by joining pids against `app.getAppMetrics()`;
  slept services report `memoryMB: 0`.
- "Saving now" figure: `ServiceViewManager` remembers each instance's last observed `memoryMB`
  (fed from the metrics call) and sums it over currently-destroyed instances —
  session-scoped, surfaced as `estimatedSavedMB` and labeled an estimate in the UI.
- Surfaces: Performance panel per-service table + saved-now line; ServiceRail tooltip shows
  MB when available. Rail numeric badges only behind a default-off `show_memory_badges`
  setting (settings enum + SettingsMap + toggle in Performance panel).
- Tests: pure join/estimate helpers with fake metrics + fake pid maps.

## 3. Notification archive + FTS5 search

- Migration `0007_notification_archive.sql`: `notifications_fts` FTS5 table
  (`title`, `body`, content-rowid mapped to `notifications.id`) + insert/update/delete
  triggers, plus initial backfill. FTS5 availability verified in the bundled better-sqlite3.
- `searchNotifications` uses `MATCH` (tokens escaped, trailing `*` prefix per token, bm25
  order) and falls back to the existing LIKE query if the FTS table is missing or the query
  yields an FTS syntax error.
- Retention: `notification_retention_days` setting (default '30'); prune uses it (invalid or
  missing → 30) and also caps per-instance rows at 5,000. Runs at startup + hourly (existing
  timer).
- Inbox archive: `notification:list` gains an optional `beforeId` cursor for paging; InboxPanel
  gets an Archive mode with a search box (FTS-backed), service grouping, and a "new since you
  last looked" divider driven by `inbox_last_seen_at` meta (set via a new
  `notification:markSeen` call when the inbox closes).
- Palette search inherits FTS automatically.
- Tests: FTS search (match, prefix, ranking sanity, quote/hyphen safety), fallback path,
  retention setting respected, per-instance cap, markSeen meta.

## 4. AI Morning Briefing + `runAiPrompt` action + schedule dedup

- **Schedule dedup (bug fix):** schedule-triggered automations currently re-fire every 60 s
  inside their window. Add `scheduleSlotStart(schedule, now)`; in `AutomationRuntime.run`,
  skip a schedule rule when `last_run_at >= slotStart` (once per occurrence). Applies to all
  schedule rules, not just AI.
- Inject optional `aiService` into `AutomationRuntimeDeps` (`{ status(): { configured }; brief();
  runPrompt(prompt, context?) }` structural type so tests use fakes).
- Implement `runAiPrompt`: `targetId` → saved AiPrompt id (via `getAiPrompt`), else `value` as
  an inline prompt, else the built-in `brief()`. Unconfigured AI or empty result → skip
  silently (recorded in the run summary). Errors are caught per action (an AI failure must not
  break other automations).
- Results persist to a new `ai_runs` table (0007): `id, kind ('brief'|'prompt'), title, text,
  created_at`, capped to the latest 50 rows. New IPC `aiRun:list` (limit) exposes them.
- Delivery: `sendPush('event:ai-run', …)` + a plain Electron `new Notification('AppDeck',
  'Your briefing is ready')` (not service-gated; suppressed when global DND is on). InboxPanel
  pins the latest `ai_runs` entry as a dismissible briefing card when present.
- Preset: "Enable morning briefing" button in the ProControls AI panel upserts a schedule
  automation (daily, 08:30–08:45 window, action `runAiPrompt` with no target/value = brief).
- Tests: slot-start dedup (fires once per occurrence, refires next day), runAiPrompt via fake
  aiService (saved prompt, inline, brief fallback, unconfigured skip, error isolation),
  ai_runs cap.

## 5. Trust rider

- Release workflow generates and attaches `SHA256SUMS.txt` for built artifacts.
- `SECURITY.md`: report channel, update/signing posture stated honestly (unsigned until a
  certificate exists), key privacy invariants (what never syncs).
- Authenticode signing itself stays operator-gated (certificate purchase).

## Out of scope (deliberate)

Cookie/session sync (violates the "never syncs cookies" promise without a reviewed E2EE
design), Chromium fork/extension-store parity, team/SAML features, mobile companion.

## Sequencing & validation

1 + 2 (same modules) → 3 → 4 → 5. TDD per behavioral change (red → green), full
`npm run release:check` (typecheck, lint, unit, build, e2e, server) before merge; commit →
push → CI → `merge --no-ff` → push both remotes → delete branch.
