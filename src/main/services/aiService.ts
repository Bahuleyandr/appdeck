import { safeStorage } from 'electron';
import type Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { AI_DEFAULT_MODEL } from '../../shared/constants.js';
import type {
  AiBrief,
  AiPromptRunResult,
  AiProvider,
  AiStatus,
  NotificationRecord,
  TriageItem
} from '../../shared/types.js';
import { getMeta, setMeta } from '../db/repositories/meta.js';
import { listNotifications } from '../db/repositories/notifications.js';
import { getServiceInstance } from '../db/repositories/serviceInstances.js';

const KEY_META = 'ai_key';
const PROVIDER_META = 'ai_provider';
const MODEL_META = 'ai_model';
const BASE_URL_META = 'ai_base_url';
const LOCAL_ONLY_META = 'ai_local_only';
const MAX_NOTIFICATIONS = 60;

const DEFAULTS: Record<AiProvider, { model: string; baseUrl: string | null }> = {
  anthropic: { model: AI_DEFAULT_MODEL, baseUrl: null },
  openai: { model: 'gpt-4.1', baseUrl: 'https://api.openai.com/v1' },
  gemini: {
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
  },
  ollama: { model: 'llama3.1', baseUrl: 'http://localhost:11434' },
  compatible: { model: 'gpt-4.1', baseUrl: 'http://localhost:11434/v1' }
};

interface AiConfigInput {
  apiKey?: string;
  provider?: AiProvider;
  model?: string;
  baseUrl?: string;
  localOnly?: boolean;
}

export class AiService {
  constructor(private readonly db: Database.Database) {}

  status(): AiStatus {
    const provider = this.provider();
    const defaults = DEFAULTS[provider];
    const model = getMeta(this.db, MODEL_META) || defaults.model;
    const baseUrl = getMeta(this.db, BASE_URL_META) || defaults.baseUrl;
    const localOnly = getMeta(this.db, LOCAL_ONLY_META) === 'true';
    return {
      configured:
        Boolean(this.apiKey()) || provider === 'ollama' || (provider === 'compatible' && localOnly),
      provider,
      model,
      baseUrl,
      localOnly
    };
  }

  configure(input: AiConfigInput): void {
    const current = this.status();
    const provider = input.provider ?? current.provider;
    const model = input.model?.trim() || DEFAULTS[provider].model;
    const baseUrl = normalizeBaseUrl(input.baseUrl) ?? DEFAULTS[provider].baseUrl;
    const localOnly = input.localOnly ?? current.localOnly;
    const apiKey = input.apiKey?.trim();

    if (localOnly && baseUrl && !isLocalUrl(baseUrl)) {
      throw new Error('Local-only AI requires a localhost, 127.0.0.1, or ::1 endpoint.');
    }
    if (provider !== 'ollama' && provider !== 'compatible' && !apiKey && !this.apiKey()) {
      throw new Error('API key is empty');
    }
    if (apiKey !== undefined) {
      this.setApiKey(apiKey);
    }
    setMeta(this.db, PROVIDER_META, provider);
    setMeta(this.db, MODEL_META, model);
    setMeta(this.db, BASE_URL_META, baseUrl ?? '');
    setMeta(this.db, LOCAL_ONLY_META, localOnly ? 'true' : 'false');
  }

  clearKey(): void {
    setMeta(this.db, KEY_META, '');
  }

  async brief(): Promise<AiBrief> {
    const notifications = this.recentNotifications();
    if (!notifications.length) {
      return {
        text: 'No notifications captured yet. Once your services start sending notifications, ask again for a brief.'
      };
    }
    const text = await this.complete({
      system:
        'You are AppDeck, a personal communications assistant. The user runs many chat/email services in one app. ' +
        'Given recent notifications across all their services, write a short "what you missed" brief in Markdown: ' +
        'group by what matters, surface anything that looks urgent or time-sensitive first, and keep it skimmable. ' +
        'Do not invent details beyond the notifications provided.',
      user: this.notificationsToPrompt(notifications),
      json: false
    });
    return { text };
  }

  async triage(): Promise<TriageItem[]> {
    const notifications = this.recentNotifications().filter(
      (notification) => !notification.read_at
    );
    if (!notifications.length) {
      return [];
    }
    const text = await this.complete({
      system:
        'You triage notifications for a busy user. Classify each by priority: "high" (needs attention soon — direct ' +
        'mentions, time-sensitive, from a person), "normal", or "low" (newsletters, automated, social noise). ' +
        'Return strict JSON only with shape {"items":[{"notificationId":number,"priority":"high|normal|low","reason":"short"}]}.',
      user: this.notificationsToPrompt(notifications),
      json: true
    });
    const byId = new Map(
      notifications.map((notification) => [notification.id, notification.instance_id])
    );
    try {
      const parsed = JSON.parse(text) as {
        items: Array<{ notificationId: number; priority: TriageItem['priority']; reason: string }>;
      };
      return parsed.items.flatMap((item) => {
        const instanceId = byId.get(item.notificationId);
        return instanceId
          ? [
              {
                notificationId: item.notificationId,
                priority: item.priority,
                reason: item.reason,
                instanceId
              }
            ]
          : [];
      });
    } catch {
      return [];
    }
  }

  async runPrompt(prompt: string, context = ''): Promise<AiPromptRunResult> {
    const text = await this.complete({
      system:
        'You are AppDeck, a privacy-aware personal workspace assistant. Follow the saved prompt exactly, keep the response concise, and do not invent details beyond the supplied context.',
      user: `${prompt.trim()}\n\nContext:\n${context.trim() || this.notificationsToPrompt(this.recentNotifications().slice(0, 20))}`,
      json: false
    });
    return { text };
  }

  async extractTasks(): Promise<AiPromptRunResult> {
    const notifications = this.recentNotifications().filter(
      (notification) => !notification.read_at
    );
    if (!notifications.length) return { text: '[]' };
    const text = await this.complete({
      system:
        'Extract actionable tasks from the supplied AppDeck notifications. Return strict JSON only: [{"title":"short action","source":"service or sender","priority":"high|normal|low"}].',
      user: this.notificationsToPrompt(notifications),
      json: true
    });
    return { text };
  }

  private async complete(input: { system: string; user: string; json: boolean }): Promise<string> {
    const status = this.status();
    if (!status.configured) {
      throw new Error('AI is not configured.');
    }
    if (status.provider === 'anthropic') {
      return this.anthropicComplete(status, input);
    }
    if (status.provider === 'gemini') {
      return this.geminiComplete(status, input);
    }
    if (status.provider === 'ollama') {
      return this.ollamaComplete(status, input);
    }
    return this.openAiCompatibleComplete(status, input);
  }

  private async anthropicComplete(
    status: AiStatus,
    input: { system: string; user: string; json: boolean }
  ): Promise<string> {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new Error('Anthropic API key is not configured.');
    }
    const response = await new Anthropic({ apiKey }).messages.create({
      model: status.model,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: input.system,
      messages: [{ role: 'user', content: input.user }]
    });
    return textOf(response);
  }

  private async openAiCompatibleComplete(
    status: AiStatus,
    input: { system: string; user: string; json: boolean }
  ): Promise<string> {
    const baseUrl = trimSlash(status.baseUrl ?? DEFAULTS.openai.baseUrl ?? '');
    const apiKey = this.apiKey();
    if (status.provider === 'openai' && !apiKey) {
      throw new Error('OpenAI API key is not configured.');
    }
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model: status.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user }
        ],
        response_format: input.json ? { type: 'json_object' } : undefined
      })
    });
    if (!response.ok) {
      throw new Error(`AI request failed (${response.status})`);
    }
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return body.choices?.[0]?.message?.content?.trim() ?? '';
  }

  private async ollamaComplete(
    status: AiStatus,
    input: { system: string; user: string; json: boolean }
  ): Promise<string> {
    const baseUrl = trimSlash(
      status.baseUrl ?? DEFAULTS.ollama.baseUrl ?? 'http://localhost:11434'
    );
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: status.model,
        stream: false,
        format: input.json ? 'json' : undefined,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status})`);
    }
    const body = (await response.json()) as { message?: { content?: string } };
    return body.message?.content?.trim() ?? '';
  }

  private async geminiComplete(
    status: AiStatus,
    input: { system: string; user: string; json: boolean }
  ): Promise<string> {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }
    const baseUrl = trimSlash(status.baseUrl ?? DEFAULTS.gemini.baseUrl ?? '');
    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(status.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: 'user', parts: [{ text: input.user }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: input.json ? 'application/json' : undefined
          }
        })
      }
    );
    if (!response.ok) {
      throw new Error(`Gemini request failed (${response.status})`);
    }
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (
      body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() ?? ''
    );
  }

  private provider(): AiProvider {
    const stored = getMeta(this.db, PROVIDER_META);
    return stored && stored in DEFAULTS ? (stored as AiProvider) : 'anthropic';
  }

  private setApiKey(value: string): void {
    if (!value) {
      setMeta(this.db, KEY_META, '');
      return;
    }
    if (safeStorage.isEncryptionAvailable()) {
      setMeta(this.db, KEY_META, `safe:${safeStorage.encryptString(value).toString('base64')}`);
    } else {
      setMeta(this.db, KEY_META, `plain:${Buffer.from(value).toString('base64')}`);
    }
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

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimSlash(trimmed) : null;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLocalUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}
