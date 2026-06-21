import { safeStorage } from 'electron';
import type Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { AI_DEFAULT_MODEL } from '../../shared/constants.js';
import type { AiBrief, AiStatus, NotificationRecord, TriageItem } from '../../shared/types.js';
import { getMeta, setMeta } from '../db/repositories/meta.js';
import { listNotifications } from '../db/repositories/notifications.js';
import { getServiceInstance } from '../db/repositories/serviceInstances.js';

const KEY_META = 'ai_key';
const MAX_NOTIFICATIONS = 60;

export class AiService {
  constructor(private readonly db: Database.Database) {}

  status(): AiStatus {
    return { configured: Boolean(getMeta(this.db, KEY_META)), model: AI_DEFAULT_MODEL };
  }

  configure(apiKey: string): void {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new Error('API key is empty');
    }
    if (safeStorage.isEncryptionAvailable()) {
      setMeta(this.db, KEY_META, `safe:${safeStorage.encryptString(trimmed).toString('base64')}`);
    } else {
      setMeta(this.db, KEY_META, `plain:${Buffer.from(trimmed).toString('base64')}`);
    }
  }

  clearKey(): void {
    setMeta(this.db, KEY_META, '');
  }

  async brief(): Promise<AiBrief> {
    const notifications = this.recentNotifications();
    if (!notifications.length) {
      return { text: 'No notifications captured yet. Once your services start sending notifications, ask again for a brief.' };
    }
    const client = this.client();
    const response = await client.messages.create({
      model: AI_DEFAULT_MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system:
        'You are AppDeck, a personal communications assistant. The user runs many chat/email services in one app. ' +
        'Given recent notifications across all their services, write a short "what you missed" brief in Markdown: ' +
        'group by what matters, surface anything that looks urgent or time-sensitive first, and keep it skimmable. ' +
        'Do not invent details beyond the notifications provided.',
      messages: [{ role: 'user', content: this.notificationsToPrompt(notifications) }]
    });
    return { text: textOf(response) };
  }

  async triage(): Promise<TriageItem[]> {
    const notifications = this.recentNotifications().filter((notification) => !notification.read_at);
    if (!notifications.length) {
      return [];
    }
    const client = this.client();
    const response = await client.messages.create({
      model: AI_DEFAULT_MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system:
        'You triage notifications for a busy user. Classify each by priority: "high" (needs attention soon — direct ' +
        'mentions, time-sensitive, from a person), "normal", or "low" (newsletters, automated, social noise). ' +
        'Return one entry per notification id provided.',
      messages: [{ role: 'user', content: this.notificationsToPrompt(notifications) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['notificationId', 'priority', 'reason'],
                  properties: {
                    notificationId: { type: 'integer' },
                    priority: { type: 'string', enum: ['high', 'normal', 'low'] },
                    reason: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    });
    const byId = new Map(notifications.map((notification) => [notification.id, notification.instance_id]));
    try {
      const parsed = JSON.parse(textOf(response)) as { items: Array<{ notificationId: number; priority: TriageItem['priority']; reason: string }> };
      return parsed.items.flatMap((item) => {
        const instanceId = byId.get(item.notificationId);
        return instanceId ? [{ notificationId: item.notificationId, priority: item.priority, reason: item.reason, instanceId }] : [];
      });
    } catch {
      return [];
    }
  }

  private client(): Anthropic {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new Error('AI is not configured. Add your Anthropic API key in Settings.');
    }
    return new Anthropic({ apiKey });
  }

  private apiKey(): string | null {
    const stored = getMeta(this.db, KEY_META);
    if (!stored) {
      return null;
    }
    if (stored.startsWith('safe:')) {
      if (!safeStorage.isEncryptionAvailable()) {
        return null;
      }
      return safeStorage.decryptString(Buffer.from(stored.slice(5), 'base64'));
    }
    if (stored.startsWith('plain:')) {
      return Buffer.from(stored.slice(6), 'base64').toString('utf8');
    }
    return null;
  }

  private recentNotifications(): NotificationRecord[] {
    return listNotifications(this.db, MAX_NOTIFICATIONS, false);
  }

  private notificationsToPrompt(notifications: NotificationRecord[]): string {
    const lines = notifications.map((notification) => {
      const service = getServiceInstance(this.db, notification.instance_id);
      const serviceName = service?.display_name ?? 'Unknown service';
      const when = new Date(notification.created_at).toISOString();
      return `- [id ${notification.id}] (${serviceName}, ${when}) ${notification.title}: ${notification.body}`.trim();
    });
    return `Here are the recent notifications, newest first:\n${lines.join('\n')}`;
  }
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}
