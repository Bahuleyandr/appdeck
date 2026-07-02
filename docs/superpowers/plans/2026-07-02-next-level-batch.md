# Next-Level Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five approved next-level features: doze tier, visible memory accounting, notification archive + FTS5 search, scheduled AI briefing (with schedule dedup + `runAiPrompt`), and the trust rider.

**Architecture:** All behavior lands in the existing 3-layer Electron split (main services/repos → zod IPC → renderer). Doze/memory extend `ServiceViewManager` + `SleepManager`; archive/briefing extend the SQLite layer via migration 0007 (FTS5 + `ai_runs`) and the automation runtime. Spec: `docs/superpowers/specs/2026-07-02-next-level-batch-design.md`.

**Tech Stack:** Electron 42, better-sqlite3 (FTS5 verified available), zod 4, React 18, vitest with per-file `vi.mock('electron')` harnesses (see `tests/unit/serviceViewGuards.test.ts`).

**Verification gate for every task:** `npx vitest run <touched tests>` red→green, and at batch end `npm run release:check` (typecheck, lint, full unit, build, e2e, server).

---

### Task 1: Doze tier

**Files:**
- Modify: `src/shared/types.ts` (SleepPolicy `mode`/`deepAfterMinutes`; ServiceState + `'dozing'`)
- Modify: `src/shared/ipc-contract.ts` (`sleepPolicySchema` + mode/deepAfterMinutes)
- Modify: `src/main/views/serviceViewManager.ts` (doze()/undoze-in-attach, tier-aware trim, `dozingInstances()`)
- Modify: `src/main/services/sleepManager.ts` (tier selection + escalation)
- Test: extend `tests/unit/serviceViewGuards.test.ts`; create `tests/unit/sleepTiering.test.ts`

- [ ] **1.1 Failing tests** — guards: `doze()` detaches (removeChildView) without `webContents.close()`, sets `setAudioMuted(true)` + `setBackgroundThrottling(true)`, emits `'dozing'`; re-`setBounds` un-dozes (audio unmuted, attach called). Tiering (fake viewManager): auto → `doze(id)` for unmuted, `sleep(id)` for muted; `mode:'deep'` forces sleep; `deepAfterMinutes:1` escalates a dozing instance (viewManager reports `isDozing(id)` true + dozeStartedAt) to `sleep(id)`; never-sleep untouched.
- [ ] **1.2 Verify red** — `npx vitest run tests/unit/serviceViewGuards.test.ts tests/unit/sleepTiering.test.ts`
- [ ] **1.3 Implement** — key shape:

```ts
// serviceViewManager.ts
doze(instanceId: string): void {
  for (const managed of this.viewsForInstance(instanceId)) {
    if (managed.dozing) continue;
    this.detach(managed);
    managed.dozing = true;
    managed.dozeStartedAt = Date.now();
    managed.view.webContents.setAudioMuted(true);
    managed.view.webContents.setBackgroundThrottling(true);
  }
  if (this.viewsForInstance(instanceId).length) this.emitState(instanceId, 'dozing');
}
isDozing(id: string): boolean; dozeStartedAt(id: string): number | null;
// attach(): if (managed.dozing) { managed.dozing = false; contents.setAudioMuted(false); markActive; }
// trimHiddenViews: tierFor(instance) === 'deep' ? destroy : doze (leave dozing views alone)

// sleepManager.ts
function sleepTier(instance: ServiceInstance): 'doze' | 'deep' {
  const mode = instance.sleep_policy.mode ?? 'auto';
  if (mode === 'deep') return 'deep';
  if (mode === 'doze') return 'doze';
  return !instance.muted && !instance.disabled ? 'doze' : 'deep';
}
// tick(): on idle expiry → tier doze ? viewManager.doze(id) : viewManager.sleep(id)
// escalation: if isDozing && deepAfterMinutes != null && now - dozeStartedAt >= deepAfterMinutes*60_000 → sleep(id)
```

- [ ] **1.4 Verify green + full unit run**
- [ ] **1.5 Renderer state mapping** — wherever `'sleeping'` is styled in `ServiceRail.tsx`/`TileLayout.tsx`, add `'dozing'` (same visual family, tooltip "Dozing — notifications still arrive").
- [ ] **1.6 Commit** — `feat: doze tier — throttled sleep that keeps notifications alive`

### Task 2: Visible memory accounting

**Files:**
- Modify: `src/main/views/serviceViewManager.ts` (`processIds()`, `recordMemory()`, `estimatedSavedMB()`)
- Modify: `src/main/services/metrics.ts` (`collectMetrics(db?, viewManager?)` adds `services` + `estimatedSavedMB`)
- Modify: `src/shared/types.ts` (`AppMetrics.services`, `estimatedSavedMB`), `src/main/ipc/register.ts` (`metrics:get` passes ctx), settings plumbing for `show_memory_badges` (settings.ts repo keys, ipc-contract enum, client SettingsMap, appStore defaults)
- Modify: `src/renderer/components/ProControls.tsx` (performance panel table + saved line + badge toggle), `src/renderer/components/ServiceRail.tsx` (tooltip/badge, poll only when enabled)
- Test: create `tests/unit/serviceMemory.test.ts` (pure join + estimate helpers with fake pid/metrics)

- [ ] **2.1 Failing tests** — `joinServiceMemory(instances, pids, osMetrics)` maps pid→MB per instance, states active/dozing/sleeping, slept = 0 MB; saved estimate sums last-known MB of currently-slept instances only.
- [ ] **2.2 Red → 2.3 implement (pure helpers exported from metrics.ts; viewManager supplies pids + last-known map) → 2.4 green**
- [ ] **2.5 Renderer surfaces** (table, saved-now line labeled "estimate, this session", default-off badges)
- [ ] **2.6 Commit** — `feat: per-service memory accounting + savings estimate`

### Task 3: Notification archive + FTS5

**Files:**
- Create: `src/main/db/migrations/0007_archive_ai.sql` (FTS5 + triggers + backfill + `ai_runs`)
- Modify: `src/main/db/migrate.ts` (register v7), `src/main/db/repositories/notifications.ts` (FTS search + fallback, retention setting, per-instance cap, `beforeId` paging), `src/main/db/repositories/settings.ts` + contract enum + SettingsMap (`notification_retention_days`), `src/shared/ipc-contract.ts` (`notification:list` beforeId; `notification:markSeen`), `src/main/ipc/register.ts`, `src/preload/bridge.ts`, `src/renderer/ipc/client.ts`, `src/renderer/components/InboxPanel.tsx` (Archive mode + search + last-seen divider)
- Test: extend `tests/unit/notifications.test.ts` (or create `tests/unit/notificationArchive.test.ts`)

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS notifications_fts USING fts5(
  title, body, content='notifications', content_rowid='id'
);
CREATE TRIGGER IF NOT EXISTS notifications_ai AFTER INSERT ON notifications BEGIN
  INSERT INTO notifications_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
CREATE TRIGGER IF NOT EXISTS notifications_ad AFTER DELETE ON notifications BEGIN
  INSERT INTO notifications_fts(notifications_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
END;
CREATE TRIGGER IF NOT EXISTS notifications_au AFTER UPDATE ON notifications BEGIN
  INSERT INTO notifications_fts(notifications_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
  INSERT INTO notifications_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
INSERT INTO notifications_fts(rowid, title, body) SELECT id, title, body FROM notifications;
CREATE TABLE IF NOT EXISTS ai_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, title TEXT NOT NULL,
  text TEXT NOT NULL, created_at INTEGER NOT NULL
);
```

- [ ] **3.1 Failing tests** — FTS match ("uploaded file" finds body token), prefix ("uplo"), quote/hyphen input does not throw (sanitizer), fallback works when FTS table dropped, retention days setting respected (+ default 30), per-instance cap 5000, markSeen sets meta, beforeId pages.
- [ ] **3.2 Red → 3.3 implement → 3.4 green.** FTS query builder: tokenize on non-word chars, wrap each token in double quotes + `*`, join with spaces; on `SqliteError` fall back to LIKE.
- [ ] **3.5 InboxPanel archive UI** (mode toggle, search input, grouped list, "new since you last looked" divider, markSeen on close)
- [ ] **3.6 Commit** — `feat: searchable notification archive (FTS5) + retention controls`

### Task 4: AI briefing + runAiPrompt + schedule dedup

**Files:**
- Create: `src/main/db/repositories/aiRuns.ts` (insert w/ cap 50, list)
- Modify: `src/main/services/automationRuntime.ts` (aiService dep, `runAiPrompt`, slot dedup), `src/main/db/repositories/automations.ts` (`scheduleSlotStart` export), `src/main/index.ts` (pass aiService + notificationService hook), `src/shared/ipc-contract.ts` (`aiRun:list`; push `event:ai-run`), `src/preload/bridge.ts`, `src/renderer/ipc/client.ts`, `src/renderer/components/InboxPanel.tsx` (briefing card), `src/renderer/components/ProControls.tsx` (AI panel preset button)
- Test: extend `tests/unit/automationRuntime.test.ts`; create `tests/unit/aiRuns.test.ts`

```ts
// automations.ts
export function scheduleSlotStart(
  schedule: Array<{ from: string; to: string; days: number[] }>, now: Date
): number | null; // start-of-active-slot timestamp, handling overnight windows; null if inactive

// automationRuntime.run(): for schedule rules —
// const slotStart = scheduleSlotStart(rule.trigger.schedule ?? [], new Date(now));
// if (slotStart !== null && rule.last_run_at !== null && rule.last_run_at >= slotStart) continue;

// executeAction 'runAiPrompt' (async fire-and-forget, errors isolated):
// prompt = targetId ? getAiPrompt(db, targetId)?.prompt : action.value || null
// result = prompt ? await ai.runPrompt(prompt) : await ai.brief()
// insertAiRun(db, { kind, title, text }); sendPush('event:ai-run', run); plain Notification unless global DND
```

- [ ] **4.1 Failing tests** — slot dedup: schedule rule fires once inside a window across repeated ticks, refires next occurrence; runAiPrompt: saved-prompt path, inline-value path, brief fallback, skip when `configured` false, one action throwing doesn't block others; ai_runs cap at 50.
- [ ] **4.2 Red → 4.3 implement → 4.4 green**
- [ ] **4.5 Surfaces** — `aiRun:list` IPC chain; InboxPanel latest-briefing card (dismiss = local state); AI panel "Enable morning briefing" upserting the preset automation (08:30–08:45, days 0–6, `runAiPrompt` no target/value).
- [ ] **4.6 Commit** — `feat: scheduled AI briefings + runAiPrompt action; schedule triggers fire once per occurrence`

### Task 5: Trust rider

**Files:** Modify `.github/workflows/release.yml` (SHA256SUMS step); Create `SECURITY.md`

- [ ] **5.1** Checksums step after build (bash on all OS runners): `sha256sum dist/*.{exe,dmg,AppImage,zip} > SHA256SUMS-<os>.txt || true`, upload with `gh release upload` to the draft tag (guard: only on tag runs).
- [ ] **5.2** `SECURITY.md`: reporting channel (GitHub security advisories), signing posture (unsigned, planned), never-syncs invariants, supported versions.
- [ ] **5.3 Commit** — `chore: release checksums + SECURITY.md`

### Task 6: Batch validation + docs + merge

- [ ] **6.1** `npm run release:check` → all green (paste tails)
- [ ] **6.2** Update `docs/UPGRADE_SWEEP_2026-07-02.md` backlog table (items now shipped) + README highlights (doze, archive, briefing) — accuracy only, no hype
- [ ] **6.3** Push branch → CI green → `merge --no-ff` → push origin+forgejo → delete branch → update memory
