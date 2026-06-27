import { z } from 'zod';

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const httpUrlSchema = z.string().refine(isHttpUrl, { message: 'URL must be http(s)' });

export const idSchema = z.string().min(1);
export const optionalStringSchema = z.string().min(1).nullable().optional();

// Fractional values from getBoundingClientRect are expected; main rounds + clamps in normalizeRect.
export const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});

export const sleepPolicySchema = z.object({
  idleMinutes: z.number().int().positive().nullable().optional()
});
export const serviceProxySchema = z
  .object({
    mode: z.enum(['direct', 'http', 'socks', 'socks4', 'socks5']),
    host: z.string().min(1).optional(),
    port: z.number().int().positive().optional(),
    username: z.string().min(1).optional(),
    bypassRules: z.string().optional()
  })
  .nullable();
export const focusRulesSchema = z.object({
  dnd: z.boolean().optional(),
  schedule: z
    .array(
      z.object({ from: z.string(), to: z.string(), days: z.array(z.number().int().min(0).max(6)) })
    )
    .optional()
});

export const declarativeUnreadSpecSchema = z
  .object({
    selector: z.string().optional(),
    read: z.enum(['text', 'attr']).optional(),
    attr: z.string().optional(),
    regex: z.string().optional(),
    titleRegex: z.string().optional()
  })
  .nullable();

export const serviceCategorySchema = z.enum([
  'Chat',
  'Email',
  'Social',
  'Dev',
  'AI',
  'Productivity',
  'Media',
  'Other'
]);
export const layoutModeSchema = z.enum(['single', 'split', 'grid']);

const automationTriggerSchema = z.object({
  type: z.enum(['notification', 'unreadThreshold', 'schedule', 'startup', 'manual']),
  serviceId: z.string().nullable().optional(),
  matchText: z.string().optional(),
  unreadAtLeast: z.number().int().nonnegative().optional(),
  schedule: z
    .array(
      z.object({ from: z.string(), to: z.string(), days: z.array(z.number().int().min(0).max(6)) })
    )
    .optional()
});

const automationActionSchema = z.object({
  type: z.enum([
    'openWorkspace',
    'openService',
    'runAiPrompt',
    'createTask',
    'setFocusMode',
    'sleepService',
    'wakeService'
  ]),
  targetId: z.string().nullable().optional(),
  value: z.string().optional()
});

const focusModeSettingsSchema = z.object({
  muteNotifications: z.boolean().optional(),
  hideMutedServices: z.boolean().optional(),
  sleepIdleMinutes: z.number().int().positive().nullable().optional(),
  allowedServiceIds: z.array(z.string()).optional(),
  blockedServiceIds: z.array(z.string()).optional()
});

const focusModeScheduleSchema = z.array(
  z.object({ from: z.string(), to: z.string(), days: z.array(z.number().int().min(0).max(6)) })
);

const firewallRuleSchema = z.object({
  id: z.string().optional(),
  service_instance_id: z.string().nullable().optional(),
  rule_type: z.enum(['domain', 'cookie', 'permission', 'download', 'clipboard', 'script']),
  pattern: z.string().min(1),
  action: z.enum(['allow', 'block', 'ask']),
  enabled: z.boolean().optional()
});

export const workspacePatchSchema = z.object({
  parent_id: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  disabled: z.boolean().optional(),
  focus_rules: focusRulesSchema.optional(),
  sleep_defaults: sleepPolicySchema.optional()
});

export const servicePatchSchema = z.object({
  profile_id: z.string().nullable().optional(),
  display_name: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  icon_path: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  muted: z.boolean().optional(),
  disabled: z.boolean().optional(),
  sleep_policy: sleepPolicySchema.optional(),
  custom_css: z.string().nullable().optional(),
  custom_js: z.string().nullable().optional(),
  proxy: serviceProxySchema.optional(),
  user_agent: z.string().nullable().optional(),
  last_url: httpUrlSchema.nullable().optional(),
  zoom_factor: z.number().positive().nullable().optional(),
  spellcheck: z.boolean().optional()
});

export const customRecipePatchSchema = z.object({
  name: z.string().min(1).optional(),
  category: serviceCategorySchema.optional(),
  start_url: httpUrlSchema.optional(),
  allowed_domains: z.array(z.string().min(1)).optional(),
  icon_path: z.string().nullable().optional(),
  default_user_agent: z.string().nullable().optional(),
  unread_spec: declarativeUnreadSpecSchema.optional(),
  mobile_mode: z.boolean().optional()
});

export const ipcSchemas = {
  'workspace:list': z.void(),
  'workspace:create': z.object({
    name: z.string().min(1),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    parentId: z.string().nullable().optional()
  }),
  'workspace:update': z.object({ id: idSchema, patch: workspacePatchSchema }),
  'workspace:delete': z.object({ id: idSchema }),
  'workspace:reorder': z.object({ orderedIds: z.array(idSchema) }),

  'profile:list': z.void(),
  'profile:create': z.object({
    label: z.string().min(1),
    color: z.string().nullable().optional(),
    note: z.string().nullable().optional()
  }),
  'profile:update': z.object({
    id: idSchema,
    patch: z.object({
      label: z.string().min(1).optional(),
      color: z.string().nullable().optional(),
      note: z.string().nullable().optional()
    })
  }),
  'profile:delete': z.object({ id: idSchema }),

  'service:list': z.object({ workspaceId: idSchema.optional() }).optional(),
  'service:create': z.object({
    recipeId: idSchema,
    workspaceId: idSchema,
    displayName: z.string().min(1),
    profileId: z.string().nullable().optional(),
    color: z.string().nullable().optional()
  }),
  'service:update': z.object({ id: idSchema, patch: servicePatchSchema }),
  'service:delete': z.object({ id: idSchema, wipeData: z.boolean().optional() }),
  'service:reorder': z.object({ workspaceId: idSchema, orderedIds: z.array(idSchema) }),
  'service:reload': z.object({ id: idSchema }),
  'service:navigateBack': z.object({ id: idSchema }),
  'service:navigateForward': z.object({ id: idSchema }),
  'service:navigate': z.object({ id: idSchema, url: httpUrlSchema }),
  'service:sleep': z.object({ id: idSchema }),
  'service:wake': z.object({ id: idSchema }),
  'service:openExternal': z.object({ id: idSchema }),
  'service:currentUrl': z.object({ id: idSchema }),
  'service:clearStorage': z.object({ id: idSchema }),
  'service:setZoom': z.object({ id: idSchema, zoomFactor: z.number().positive() }),
  'service:find': z.object({ id: idSchema, text: z.string(), forward: z.boolean().optional() }),
  'service:stopFind': z.object({ id: idSchema }),

  'view:setBounds': z.object({
    entries: z.array(z.object({ viewId: idSchema, rect: rectSchema })),
    visibleIds: z.array(idSchema)
  }),
  'view:focus': z.object({ instanceId: idSchema }),

  'tab:list': z.object({ instanceId: idSchema }),
  'tab:create': z.object({ instanceId: idSchema, url: httpUrlSchema.optional() }),
  'tab:close': z.object({ id: idSchema }),
  'tab:setActive': z.object({ instanceId: idSchema, id: idSchema }),

  'recipe:catalog': z.void(),
  'recipe:createCustom': z.object({
    name: z.string().min(1),
    category: serviceCategorySchema,
    start_url: httpUrlSchema,
    allowed_domains: z.array(z.string().min(1)),
    icon_path: z.string().nullable().optional(),
    default_user_agent: z.string().nullable().optional(),
    unread_spec: declarativeUnreadSpecSchema.optional(),
    mobile_mode: z.boolean().optional()
  }),
  'recipe:updateCustom': z.object({ id: idSchema, patch: customRecipePatchSchema }),
  'recipe:deleteCustom': z.object({ id: idSchema }),
  'recipe:resolveForInstance': z.object({ instanceId: idSchema }),
  'registry:search': z
    .object({ q: z.string().optional(), limit: z.number().int().positive().max(2000).optional() })
    .optional(),
  'registry:validate': z.object({ data: z.string().min(1) }),
  'registry:import': z.object({ data: z.string().min(1) }),
  'registry:stats': z.void(),

  'linkRule:list': z.void(),
  'linkRule:upsert': z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    priority: z.number().int().optional(),
    match_type: z.enum(['exact', 'domain', 'contains', 'regex']),
    pattern: z.string().min(1),
    target_type: z.enum(['service', 'workspace', 'profile', 'external']),
    target_id: z.string().nullable().optional(),
    enabled: z.boolean().optional()
  }),
  'linkRule:delete': z.object({ id: idSchema }),
  'linkRule:test': z.object({ url: z.string().url() }),

  'dashboard:list': z.object({ workspaceId: z.string().nullable().optional() }).optional(),
  'dashboard:upsert': z.object({
    id: z.string().optional(),
    workspace_id: z.string().nullable().optional(),
    name: z.string().min(1),
    widgets: z.array(z.record(z.string(), z.unknown())).optional()
  }),
  'dashboard:delete': z.object({ id: idSchema }),
  'dashboard:snapshot': z.object({ workspaceId: z.string().nullable().optional() }).optional(),
  'dashboard:saveSession': z.object({
    workspaceId: z.string().nullable().optional(),
    name: z.string().min(1),
    serviceIds: z.array(idSchema)
  }),

  'shortcut:list': z.void(),
  'shortcut:upsert': z.object({
    id: z.string().optional(),
    command: z.string().min(1),
    accelerator: z.string().min(1),
    scope: z.enum(['global', 'workspace', 'service']).optional(),
    target_id: z.string().nullable().optional(),
    enabled: z.boolean().optional()
  }),
  'shortcut:delete': z.object({ id: idSchema }),

  'permission:list': z.void(),
  'permission:upsert': z.object({
    id: z.string().optional(),
    service_instance_id: z.string().nullable().optional(),
    permission: z.string().min(1),
    decision: z.enum(['ask', 'allow', 'deny'])
  }),
  'permission:delete': z.object({ id: idSchema }),

  'download:list': z.object({ limit: z.number().int().positive().max(500).optional() }).optional(),
  'download:open': z.object({ id: idSchema }),
  'download:clear': z.void(),

  'migration:preview': z.object({ data: z.string().min(1) }),
  'migration:run': z.object({
    data: z.string().min(1),
    workspaceId: z.string().nullable().optional()
  }),

  'trust:status': z.void(),
  'performance:status': z.void(),

  'automation:list': z.void(),
  'automation:upsert': z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    enabled: z.boolean().optional(),
    trigger: automationTriggerSchema,
    actions: z.array(automationActionSchema).min(1)
  }),
  'automation:delete': z.object({ id: idSchema }),
  'automation:test': z.object({
    id: idSchema.optional(),
    trigger: automationTriggerSchema.optional(),
    sample: z.record(z.string(), z.unknown()).optional()
  }),

  'focusMode:list': z.void(),
  'focusMode:upsert': z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    enabled: z.boolean().optional(),
    workspace_id: z.string().nullable().optional(),
    schedule: focusModeScheduleSchema.optional(),
    settings: focusModeSettingsSchema.optional()
  }),
  'focusMode:delete': z.object({ id: idSchema }),
  'focusMode:status': z.void(),

  'browserImport:preview': z.object({ data: z.string().min(1) }),
  'browserImport:run': z.object({
    data: z.string().min(1),
    workspaceId: z.string().nullable().optional()
  }),

  'recipeStudio:analyze': z.object({
    name: z.string().min(1),
    url: httpUrlSchema,
    category: serviceCategorySchema.optional()
  }),
  'recipeStudio:create': z.object({
    name: z.string().min(1),
    url: httpUrlSchema,
    category: serviceCategorySchema,
    aliases: z.array(z.string()).optional(),
    mobileMode: z.boolean().optional()
  }),

  'extensionPack:list': z.void(),
  'extensionPack:apply': z.object({ id: idSchema }),

  'firewall:list': z.void(),
  'firewall:upsert': firewallRuleSchema,
  'firewall:delete': z.object({ id: idSchema }),
  'firewall:test': z.object({
    url: z.string().url(),
    serviceInstanceId: z.string().nullable().optional()
  }),

  'snapshot:list': z.object({ workspaceId: z.string().nullable().optional() }).optional(),
  'snapshot:create': z.object({ workspaceId: idSchema, name: z.string().min(1) }),
  'snapshot:restore': z.object({ id: idSchema }),
  'snapshot:delete': z.object({ id: idSchema }),

  'analytics:personal': z.void(),

  'repair:status': z.void(),
  'repair:run': z.void(),

  'portable:status': z.void(),
  'portable:configure': z.object({
    enabled: z.boolean(),
    rootPath: z.string().nullable().optional()
  }),

  'peerSync:status': z.void(),
  'peerSync:upsert': z.object({
    id: z.string().optional(),
    label: z.string().min(1),
    endpoint: z.string().min(1),
    enabled: z.boolean().optional()
  }),
  'peerSync:sync': z.object({ id: idSchema }),
  'peerSync:delete': z.object({ id: idSchema }),

  'workKit:list': z.void(),
  'workKit:apply': z.object({ id: idSchema }),

  'layout:get': z.object({ workspaceId: idSchema }),
  'layout:set': z.object({
    workspaceId: idSchema,
    mode: layoutModeSchema,
    selectedServiceIds: z.array(idSchema),
    tileSizing: z.record(z.string(), z.unknown())
  }),

  'lock:status': z.void(),
  'lock:setup': z.object({ passphrase: z.string().min(4) }),
  'lock:unlock': z.object({ passphrase: z.string().min(1) }),
  'lock:lock': z.void(),

  'sync:status': z.void(),
  'sync:configure': z.object({ folderPath: z.string().min(1), passphrase: z.string().min(1) }),
  'sync:join': z.object({
    folderPath: z.string().min(1),
    recoveryPhrase: z.string().min(1),
    passphrase: z.string().min(1)
  }),
  'sync:exportVault': z.object({ targetPath: z.string().min(1), passphrase: z.string().min(1) }),
  'sync:importVault': z.object({ sourcePath: z.string().min(1), passphrase: z.string().min(1) }),
  'sync:now': z.void(),

  'task:list': z.void(),
  'task:create': z.object({ title: z.string().min(1) }),
  'task:update': z.object({
    id: idSchema,
    patch: z.object({ title: z.string().min(1).optional(), done: z.boolean().optional() })
  }),
  'task:delete': z.object({ id: idSchema }),
  'task:reorder': z.object({ orderedIds: z.array(idSchema) }),

  'palette:query': z.object({ q: z.string() }),

  'notify:incoming': z.object({
    instanceId: idSchema,
    title: z.string(),
    body: z.string().optional(),
    icon: z.string().optional()
  }),
  'unread:report': z.object({
    instanceId: idSchema,
    count: z.object({
      direct: z.number().int().nonnegative(),
      indirect: z.number().int().nonnegative()
    })
  }),

  'notification:list': z
    .object({
      limit: z.number().int().positive().max(500).optional(),
      unreadOnly: z.boolean().optional()
    })
    .optional(),
  'notification:search': z.object({ q: z.string() }),
  'notification:markRead': z.object({ id: z.number().int().positive() }),
  'notification:markAllRead': z.void(),
  'notification:snooze': z.object({
    id: z.number().int().positive(),
    until: z.number().int().positive()
  }),
  'notification:clear': z.void(),
  'notification:unreadCount': z.void(),

  'ai:status': z.void(),
  'ai:configure': z.object({
    apiKey: z.string().optional(),
    provider: z.enum(['anthropic', 'openai', 'gemini', 'ollama', 'compatible']).optional(),
    model: z.string().min(1).optional(),
    baseUrl: z.string().optional(),
    localOnly: z.boolean().optional()
  }),
  'ai:clearKey': z.void(),
  'ai:brief': z.void(),
  'ai:triage': z.void(),
  'aiPrompt:list': z.void(),
  'aiPrompt:upsert': z.object({
    id: z.string().optional(),
    title: z.string().min(1),
    prompt: z.string().min(1),
    provider: z
      .enum(['anthropic', 'openai', 'gemini', 'ollama', 'compatible'])
      .nullable()
      .optional(),
    model: z.string().nullable().optional(),
    local_only: z.boolean().optional()
  }),
  'aiPrompt:delete': z.object({ id: idSchema }),
  'aiPrompt:run': z.object({
    id: idSchema.optional(),
    prompt: z.string().optional(),
    context: z.string().optional()
  }),
  'aiPrompt:extractTasks': z.void(),

  'extension:list': z.void(),
  'extension:add': z.object({ path: z.string().min(1) }),
  'extension:remove': z.object({ id: idSchema }),
  'extension:setEnabled': z.object({ id: idSchema, enabled: z.boolean() }),

  'import:ferdium': z.object({ data: z.string().min(1), workspaceId: idSchema.optional() }),

  'metrics:get': z.void(),

  'settings:get': z.void(),
  'settings:set': z.object({
    key: z.enum([
      'theme',
      'global_dnd',
      'tracker_block',
      'close_to_tray',
      'global_hotkey',
      'onboarded',
      'launch_at_login',
      'auto_lock_minutes',
      'portable_mode_enabled',
      'portable_mode_root'
    ]),
    value: z.string()
  }),

  'update:status': z.void(),
  'update:check': z.void(),
  'update:install': z.void(),

  'account:status': z.void(),
  'account:signup': z.object({
    serverUrl: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8)
  }),
  'account:login': z.object({
    serverUrl: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(1)
  }),
  'account:logout': z.void(),
  'account:syncNow': z.void()
} as const;

export type IpcChannel = keyof typeof ipcSchemas;

export const pushChannels = [
  'event:unread',
  'event:notification-clicked',
  'event:service-state',
  'event:locked',
  'event:data-changed',
  'event:notification',
  'event:update-status',
  'event:settings-changed'
] as const;

export type PushChannel = (typeof pushChannels)[number];

export function parseIpcPayload<T extends IpcChannel>(
  channel: T,
  payload: unknown
): z.infer<(typeof ipcSchemas)[T]> {
  const schema = ipcSchemas[channel];
  if (schema instanceof z.ZodVoid) {
    return schema.parse(undefined) as z.infer<(typeof ipcSchemas)[T]>;
  }
  return schema.parse(payload) as z.infer<(typeof ipcSchemas)[T]>;
}
