import type Database from 'better-sqlite3';
import type { WorkKit } from '../../../shared/types.js';
import { parseJson, stringifyJson, toBool } from './json.js';

interface WorkKitRow {
  id: string;
  name: string;
  description: string;
  payload_json: string;
  built_in: number;
  created_at: number;
  updated_at: number;
}

function mapWorkKit(row: WorkKitRow): WorkKit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    payload: parseJson<WorkKit['payload']>(row.payload_json, {
      workspaceName: row.name,
      services: []
    }),
    built_in: toBool(row.built_in),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function seedWorkKits(db: Database.Database): void {
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO work_kits
      (id, name, description, payload_json, built_in, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  );
  db.transaction(() => {
    for (const kit of builtInKits()) {
      stmt.run(kit.id, kit.name, kit.description, stringifyJson(kit.payload), now, now);
    }
  })();
}

export function listWorkKits(db: Database.Database): WorkKit[] {
  seedWorkKits(db);
  return (
    db.prepare('SELECT * FROM work_kits ORDER BY built_in DESC, name ASC').all() as WorkKitRow[]
  ).map(mapWorkKit);
}

export function getWorkKit(db: Database.Database, id: string): WorkKit | null {
  seedWorkKits(db);
  const row = db.prepare('SELECT * FROM work_kits WHERE id = ?').get(id) as WorkKitRow | undefined;
  return row ? mapWorkKit(row) : null;
}

function builtInKits(): WorkKit[] {
  const now = Date.now();
  return [
    {
      id: 'kit-founder',
      name: 'Founder',
      description: 'Mail, calendar, chat, docs, CRM, analytics, and investor notes.',
      payload: {
        workspaceName: 'Founder OS',
        services: [
          { name: 'Gmail', url: 'https://mail.google.com', category: 'Email' },
          { name: 'Calendar', url: 'https://calendar.google.com', category: 'Productivity' },
          { name: 'Slack', url: 'https://app.slack.com', category: 'Chat' },
          { name: 'Notion', url: 'https://www.notion.so', category: 'Productivity' },
          { name: 'HubSpot', url: 'https://app.hubspot.com', category: 'Productivity' },
          { name: 'Stripe', url: 'https://dashboard.stripe.com', category: 'Productivity' }
        ],
        aiPrompts: [
          {
            title: 'Founder Catch-Up',
            prompt:
              'Summarize urgent customer, revenue, hiring, and investor items from this context.'
          }
        ]
      },
      built_in: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'kit-developer',
      name: 'Developer',
      description: 'Code hosting, incidents, docs, terminals, AI, and team chat.',
      payload: {
        workspaceName: 'Developer Desk',
        services: [
          { name: 'GitHub', url: 'https://github.com', category: 'Dev' },
          { name: 'Linear', url: 'https://linear.app', category: 'Productivity' },
          { name: 'Sentry', url: 'https://sentry.io', category: 'Dev' },
          { name: 'Cloudflare', url: 'https://dash.cloudflare.com', category: 'Dev' },
          { name: 'ChatGPT', url: 'https://chatgpt.com', category: 'AI' },
          { name: 'Slack', url: 'https://app.slack.com', category: 'Chat' }
        ],
        aiPrompts: [
          {
            title: 'Incident Triage',
            prompt:
              'Extract symptoms, likely owner, severity, and next debugging command from this context.'
          }
        ]
      },
      built_in: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'kit-student',
      name: 'Student',
      description: 'Classes, notes, research, tasks, writing, and study focus.',
      payload: {
        workspaceName: 'Study Hub',
        services: [
          {
            name: 'Google Classroom',
            url: 'https://classroom.google.com',
            category: 'Productivity'
          },
          { name: 'Google Docs', url: 'https://docs.google.com', category: 'Productivity' },
          { name: 'Notion', url: 'https://www.notion.so', category: 'Productivity' },
          { name: 'Perplexity', url: 'https://www.perplexity.ai', category: 'AI' },
          { name: 'YouTube', url: 'https://www.youtube.com', category: 'Media' }
        ],
        focusMode: { name: 'Study Block', settings: { muteNotifications: true } }
      },
      built_in: true,
      created_at: now,
      updated_at: now
    }
  ];
}
