import type Database from 'better-sqlite3';
import type { AutomationAction, AutomationRule, UnreadCount } from '../../shared/types.js';
import { getAiPrompt } from '../db/repositories/aiPrompts.js';
import { insertAiRun } from '../db/repositories/aiRuns.js';
import {
  listAutomations,
  markAutomationRun,
  scheduleSlotStart,
  testAutomation
} from '../db/repositories/automations.js';
import { createTask } from '../db/repositories/tasks.js';

export interface AutomationRuntimeDeps {
  db: Database.Database;
  viewManager: {
    sleep(instanceId: string): void;
    wake(instanceId: string): void;
    focus(instanceId: string): void;
  };
  sendPush: (channel: string, payload?: unknown) => void;
  sendDataChanged: () => void;
  /** Structural so tests can fake it; wired to AiService in main. */
  aiService?: {
    status(): { configured: boolean };
    brief(): Promise<{ text: string }>;
    runPrompt(prompt: string, context?: string): Promise<{ text: string }>;
  };
  /** Plain user-facing toast (not service-gated); wired to Electron Notification in main. */
  notifyUser?: (title: string, body: string) => void;
}

export interface AutomationRunSummary {
  ran: number;
  actionCount: number;
}

export class AutomationRuntime {
  private scheduleTimer: NodeJS.Timeout | null = null;
  private aiRunsInFlight: Array<Promise<void>> = [];

  constructor(private readonly deps: AutomationRuntimeDeps) {}

  /** Await outstanding fire-and-forget AI actions (used by tests and shutdown). */
  async settle(): Promise<void> {
    while (this.aiRunsInFlight.length) {
      const pending = this.aiRunsInFlight;
      this.aiRunsInFlight = [];
      await Promise.allSettled(pending);
    }
  }

  start(): void {
    this.handleStartup();
    this.scheduleTimer = setInterval(() => this.handleSchedule(), 60_000);
    this.scheduleTimer.unref();
  }

  dispose(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  handleStartup(): AutomationRunSummary {
    return this.run({ event: 'startup' });
  }

  handleSchedule(now = Date.now()): AutomationRunSummary {
    return this.run({ event: 'schedule', now });
  }

  handleNotification(input: {
    instanceId: string;
    title: string;
    body?: string;
  }): AutomationRunSummary {
    return this.run({
      event: 'notification',
      serviceId: input.instanceId,
      title: input.title,
      body: input.body ?? ''
    });
  }

  handleUnread(input: { instanceId: string; count: UnreadCount }): AutomationRunSummary {
    return this.run({
      event: 'unreadThreshold',
      serviceId: input.instanceId,
      unread: input.count.direct + input.count.indirect
    });
  }

  private run(sample: Record<string, unknown>): AutomationRunSummary {
    let ran = 0;
    let actionCount = 0;
    for (const rule of listAutomations(this.deps.db).filter((candidate) => candidate.enabled)) {
      if (!triggerCanRunForEvent(rule, String(sample.event ?? ''))) {
        continue;
      }
      const result = testAutomation(rule, sample);
      if (!result.matched) {
        continue;
      }
      // Schedule rules fire once per window occurrence, not on every 60-second tick inside it.
      if (rule.trigger.type === 'schedule') {
        const slotStart = scheduleSlotStart(
          rule.trigger.schedule ?? [],
          new Date(Number(sample.now) || Date.now())
        );
        if (slotStart !== null && rule.last_run_at !== null && rule.last_run_at >= slotStart) {
          continue;
        }
      }
      for (const action of result.actions) {
        this.executeAction(action, sample);
        actionCount += 1;
      }
      // Record the run at the event's own clock so schedule dedup works under injected time.
      markAutomationRun(this.deps.db, rule.id, Number(sample.now) || Date.now());
      ran += 1;
    }
    if (ran > 0) {
      this.deps.sendDataChanged();
    }
    return { ran, actionCount };
  }

  private executeAction(action: AutomationAction, sample: Record<string, unknown>): void {
    const targetId = action.targetId ?? stringSample(sample.serviceId);
    if (action.type === 'runAiPrompt') {
      this.aiRunsInFlight.push(this.runAiAction(action));
      return;
    }
    if (action.type === 'createTask') {
      createTask(this.deps.db, action.value || taskTitle(sample));
      return;
    }
    if (action.type === 'sleepService' && targetId) {
      this.deps.viewManager.sleep(targetId);
      return;
    }
    if (action.type === 'wakeService' && targetId) {
      this.deps.viewManager.wake(targetId);
      return;
    }
    if (action.type === 'openService' && targetId) {
      this.deps.viewManager.wake(targetId);
      this.deps.viewManager.focus(targetId);
      this.deps.sendPush('event:notification-clicked', { instanceId: targetId });
      return;
    }
    if (action.type === 'openWorkspace' && action.targetId) {
      this.deps.sendPush('event:workspace-open-requested', { workspaceId: action.targetId });
      return;
    }
    if (action.type === 'setFocusMode' && action.targetId) {
      this.deps.sendPush('event:focus-mode-requested', { focusModeId: action.targetId });
    }
  }

  // Fire-and-forget by design: an AI provider failure must never break the other actions of a
  // rule or the runtime loop. Failures are swallowed after logging; successes are persisted to
  // ai_runs and announced.
  private async runAiAction(action: AutomationAction): Promise<void> {
    const ai = this.deps.aiService;
    if (!ai || !ai.status().configured) {
      return;
    }
    try {
      const saved = action.targetId ? getAiPrompt(this.deps.db, action.targetId) : null;
      const prompt = saved?.prompt ?? (action.value?.trim() || null);
      const kind = prompt ? 'prompt' : 'brief';
      const title = saved?.title ?? (prompt ? 'AI prompt' : 'Briefing');
      const result = prompt ? await ai.runPrompt(prompt) : await ai.brief();
      if (!result.text.trim()) {
        return;
      }
      const run = insertAiRun(this.deps.db, { kind, title, text: result.text });
      this.deps.sendPush('event:ai-run', run);
      this.deps.notifyUser?.(
        'AppDeck',
        kind === 'brief' ? 'Your briefing is ready.' : `"${title}" finished.`
      );
    } catch (error) {
      console.error('AI automation action failed', error);
    }
  }
}

function triggerCanRunForEvent(rule: AutomationRule, event: string): boolean {
  if (rule.trigger.type === 'manual') return false;
  if (rule.trigger.type === 'schedule') return event === 'schedule';
  return rule.trigger.type === event;
}

function stringSample(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function taskTitle(sample: Record<string, unknown>): string {
  const title = stringSample(sample.title);
  return title ? `Follow up: ${title}` : 'Follow up from automation';
}
