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
    `INSERT INTO work_kits
      (id, name, description, payload_json, built_in, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       payload_json = excluded.payload_json,
       built_in = excluded.built_in,
       updated_at = excluded.updated_at`
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
  const widgets = [
    { id: 'unread', type: 'unread' as const, title: 'Unread', config: {} },
    { id: 'tasks', type: 'tasks' as const, title: 'Tasks', config: { limit: 8 } },
    {
      id: 'notifications',
      type: 'notifications' as const,
      title: 'Recent',
      config: { limit: 8 }
    },
    { id: 'notes', type: 'notes' as const, title: 'Notes', config: {} }
  ];
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
        ],
        focusMode: { name: 'Founder Focus', settings: { muteNotifications: true } },
        dashboards: [{ name: 'Founder Dashboard', widgets }],
        linkRules: [
          {
            name: 'Revenue to Founder OS',
            match_type: 'domain',
            pattern: 'stripe.com',
            target_type: 'workspace'
          }
        ],
        automations: [
          {
            name: 'Urgent customer follow-up',
            trigger: { type: 'notification', matchText: 'urgent' },
            actions: [{ type: 'createTask', value: 'Follow up on urgent customer item' }]
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
        ],
        focusMode: { name: 'Maker Mode', settings: { muteNotifications: true } },
        dashboards: [{ name: 'Developer Dashboard', widgets }],
        linkRules: [
          {
            name: 'GitHub to Developer Desk',
            match_type: 'domain',
            pattern: 'github.com',
            target_type: 'workspace'
          }
        ],
        automations: [
          {
            name: 'Incident notification to task',
            trigger: { type: 'notification', matchText: 'incident' },
            actions: [{ type: 'createTask', value: 'Triage incident notification' }]
          },
          {
            name: 'High unread developer focus',
            trigger: { type: 'unreadThreshold', unreadAtLeast: 10 },
            actions: [{ type: 'openWorkspace', targetId: '$workspace' }]
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
        focusMode: { name: 'Study Block', settings: { muteNotifications: true } },
        dashboards: [{ name: 'Study Dashboard', widgets }],
        linkRules: [
          {
            name: 'Classroom to Study Hub',
            match_type: 'domain',
            pattern: 'classroom.google.com',
            target_type: 'workspace'
          }
        ],
        automations: [
          {
            name: 'Assignment notification to task',
            trigger: { type: 'notification', matchText: 'assignment' },
            actions: [{ type: 'createTask', value: 'Review new assignment' }]
          }
        ]
      },
      built_in: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'kit-agency',
      name: 'Agency',
      description: 'Client inboxes, delivery boards, analytics, design review, and approvals.',
      payload: {
        workspaceName: 'Agency Studio',
        services: [
          { name: 'Gmail', url: 'https://mail.google.com', category: 'Email' },
          { name: 'Slack', url: 'https://app.slack.com', category: 'Chat' },
          { name: 'Asana', url: 'https://app.asana.com', category: 'Productivity' },
          { name: 'Figma', url: 'https://www.figma.com/files', category: 'Productivity' },
          {
            name: 'Google Analytics',
            url: 'https://analytics.google.com',
            category: 'Productivity'
          },
          { name: 'Canva', url: 'https://www.canva.com', category: 'Productivity' }
        ],
        aiPrompts: [
          {
            title: 'Client Status Brief',
            prompt: 'Create a short client-ready status brief from notifications, tasks, and notes.'
          }
        ],
        focusMode: { name: 'Client Delivery', settings: { muteNotifications: false } },
        dashboards: [{ name: 'Agency Dashboard', widgets }],
        linkRules: [
          {
            name: 'Figma to Agency Studio',
            match_type: 'domain',
            pattern: 'figma.com',
            target_type: 'workspace'
          }
        ],
        automations: [
          {
            name: 'Approval request to task',
            trigger: { type: 'notification', matchText: 'approval' },
            actions: [{ type: 'createTask', value: 'Handle client approval request' }]
          }
        ]
      },
      built_in: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'kit-researcher',
      name: 'Researcher',
      description: 'Papers, notes, citations, AI synthesis, datasets, and deep-work rhythm.',
      payload: {
        workspaceName: 'Research Lab',
        services: [
          { name: 'Google Scholar', url: 'https://scholar.google.com', category: 'Productivity' },
          { name: 'Zotero', url: 'https://www.zotero.org', category: 'Productivity' },
          { name: 'Notion', url: 'https://www.notion.so', category: 'Productivity' },
          { name: 'Perplexity', url: 'https://www.perplexity.ai', category: 'AI' },
          { name: 'arXiv', url: 'https://arxiv.org', category: 'Productivity' }
        ],
        aiPrompts: [
          {
            title: 'Research Synthesis',
            prompt: 'Synthesize claims, evidence, contradictions, and follow-up questions.'
          }
        ],
        focusMode: { name: 'Reading Block', settings: { muteNotifications: true } },
        dashboards: [{ name: 'Research Dashboard', widgets }],
        linkRules: [
          {
            name: 'Papers to Research Lab',
            match_type: 'domain',
            pattern: 'arxiv.org',
            target_type: 'workspace'
          }
        ],
        automations: [
          {
            name: 'Paper mention to task',
            trigger: { type: 'notification', matchText: 'paper' },
            actions: [{ type: 'createTask', value: 'Review mentioned paper' }]
          }
        ]
      },
      built_in: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'kit-creator',
      name: 'Creator',
      description: 'Content planning, publishing, audience messages, analytics, and creative flow.',
      payload: {
        workspaceName: 'Creator Desk',
        services: [
          { name: 'YouTube Studio', url: 'https://studio.youtube.com', category: 'Media' },
          { name: 'Instagram', url: 'https://www.instagram.com', category: 'Social' },
          { name: 'X', url: 'https://x.com', category: 'Social' },
          { name: 'Canva', url: 'https://www.canva.com', category: 'Productivity' },
          { name: 'Notion', url: 'https://www.notion.so', category: 'Productivity' },
          { name: 'ChatGPT', url: 'https://chatgpt.com', category: 'AI' }
        ],
        aiPrompts: [
          {
            title: 'Content Repurposer',
            prompt: 'Turn the selected context into short post ideas, hooks, and next actions.'
          }
        ],
        focusMode: { name: 'Creation Sprint', settings: { muteNotifications: true } },
        dashboards: [{ name: 'Creator Dashboard', widgets }],
        linkRules: [
          {
            name: 'YouTube Studio to Creator Desk',
            match_type: 'domain',
            pattern: 'studio.youtube.com',
            target_type: 'workspace'
          }
        ],
        automations: [
          {
            name: 'Sponsor mention to task',
            trigger: { type: 'notification', matchText: 'sponsor' },
            actions: [{ type: 'createTask', value: 'Review sponsor opportunity' }]
          }
        ]
      },
      built_in: true,
      created_at: now,
      updated_at: now
    }
  ];
}
