import { z } from 'zod';

export const idSchema = z.string().min(1);
export const optionalStringSchema = z.string().min(1).nullable().optional();

export const rectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative()
});

export const sleepPolicySchema = z.object({ idleMinutes: z.number().int().positive().nullable().optional() });
export const focusRulesSchema = z.object({
  dnd: z.boolean().optional(),
  schedule: z
    .array(z.object({ from: z.string(), to: z.string(), days: z.array(z.number().int().min(0).max(6)) }))
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

export const serviceCategorySchema = z.enum(['Chat', 'Email', 'Social', 'Dev', 'AI', 'Other']);
export const layoutModeSchema = z.enum(['single', 'split', 'grid']);

export const workspacePatchSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  focus_rules: focusRulesSchema.optional(),
  sleep_defaults: sleepPolicySchema.optional()
});

export const servicePatchSchema = z.object({
  profile_id: z.string().nullable().optional(),
  display_name: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  muted: z.boolean().optional(),
  sleep_policy: sleepPolicySchema.optional(),
  custom_css: z.string().nullable().optional(),
  custom_js: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  last_url: z.string().nullable().optional()
});

export const customRecipePatchSchema = z.object({
  name: z.string().min(1).optional(),
  category: serviceCategorySchema.optional(),
  start_url: z.string().url().optional(),
  allowed_domains: z.array(z.string().min(1)).optional(),
  icon_path: z.string().nullable().optional(),
  default_user_agent: z.string().nullable().optional(),
  unread_spec: declarativeUnreadSpecSchema.optional(),
  mobile_mode: z.boolean().optional()
});

export const ipcSchemas = {
  'workspace:list': z.void(),
  'workspace:create': z.object({ name: z.string().min(1), icon: z.string().nullable().optional(), color: z.string().nullable().optional() }),
  'workspace:update': z.object({ id: idSchema, patch: workspacePatchSchema }),
  'workspace:delete': z.object({ id: idSchema }),
  'workspace:reorder': z.object({ orderedIds: z.array(idSchema) }),

  'profile:list': z.void(),
  'profile:create': z.object({ label: z.string().min(1), color: z.string().nullable().optional(), note: z.string().nullable().optional() }),
  'profile:update': z.object({ id: idSchema, patch: z.object({ label: z.string().min(1).optional(), color: z.string().nullable().optional(), note: z.string().nullable().optional() }) }),
  'profile:delete': z.object({ id: idSchema }),

  'service:list': z.object({ workspaceId: idSchema.optional() }).optional(),
  'service:create': z.object({ recipeId: idSchema, workspaceId: idSchema, displayName: z.string().min(1), profileId: z.string().nullable().optional(), color: z.string().nullable().optional() }),
  'service:update': z.object({ id: idSchema, patch: servicePatchSchema }),
  'service:delete': z.object({ id: idSchema, wipeData: z.boolean().optional() }),
  'service:reorder': z.object({ workspaceId: idSchema, orderedIds: z.array(idSchema) }),
  'service:reload': z.object({ id: idSchema }),
  'service:navigateBack': z.object({ id: idSchema }),
  'service:navigateForward': z.object({ id: idSchema }),
  'service:navigate': z.object({ id: idSchema, url: z.string().url() }),
  'service:sleep': z.object({ id: idSchema }),
  'service:wake': z.object({ id: idSchema }),

  'view:setBounds': z.object({ entries: z.array(z.object({ viewId: idSchema, rect: rectSchema })), visibleIds: z.array(idSchema) }),
  'view:focus': z.object({ instanceId: idSchema }),

  'tab:list': z.object({ instanceId: idSchema }),
  'tab:create': z.object({ instanceId: idSchema, url: z.string().url().optional() }),
  'tab:close': z.object({ id: idSchema }),
  'tab:setActive': z.object({ instanceId: idSchema, id: idSchema }),

  'recipe:catalog': z.void(),
  'recipe:createCustom': z.object({
    name: z.string().min(1),
    category: serviceCategorySchema,
    start_url: z.string().url(),
    allowed_domains: z.array(z.string().min(1)),
    icon_path: z.string().nullable().optional(),
    default_user_agent: z.string().nullable().optional(),
    unread_spec: declarativeUnreadSpecSchema.optional(),
    mobile_mode: z.boolean().optional()
  }),
  'recipe:updateCustom': z.object({ id: idSchema, patch: customRecipePatchSchema }),
  'recipe:deleteCustom': z.object({ id: idSchema }),
  'recipe:resolveForInstance': z.object({ instanceId: idSchema }),

  'layout:get': z.object({ workspaceId: idSchema }),
  'layout:set': z.object({ workspaceId: idSchema, mode: layoutModeSchema, selectedServiceIds: z.array(idSchema), tileSizing: z.record(z.string(), z.unknown()) }),

  'lock:status': z.void(),
  'lock:setup': z.object({ passphrase: z.string().min(4) }),
  'lock:unlock': z.object({ passphrase: z.string().min(1) }),
  'lock:lock': z.void(),

  'sync:status': z.void(),
  'sync:configure': z.object({ folderPath: z.string().min(1), passphrase: z.string().min(1) }),
  'sync:join': z.object({ folderPath: z.string().min(1), recoveryPhrase: z.string().min(1), passphrase: z.string().min(1) }),
  'sync:exportVault': z.object({ targetPath: z.string().min(1), passphrase: z.string().min(1) }),
  'sync:importVault': z.object({ sourcePath: z.string().min(1), passphrase: z.string().min(1) }),
  'sync:now': z.void(),

  'task:list': z.void(),
  'task:create': z.object({ title: z.string().min(1) }),
  'task:update': z.object({ id: idSchema, patch: z.object({ title: z.string().min(1).optional(), done: z.boolean().optional() }) }),
  'task:delete': z.object({ id: idSchema }),
  'task:reorder': z.object({ orderedIds: z.array(idSchema) }),

  'palette:query': z.object({ q: z.string() }),

  'notify:incoming': z.object({ instanceId: idSchema, title: z.string(), body: z.string().optional(), icon: z.string().optional() }),
  'unread:report': z.object({ instanceId: idSchema, count: z.object({ direct: z.number().int().nonnegative(), indirect: z.number().int().nonnegative() }) }),

  'notification:list': z.object({ limit: z.number().int().positive().max(500).optional(), unreadOnly: z.boolean().optional() }).optional(),
  'notification:search': z.object({ q: z.string() }),
  'notification:markRead': z.object({ id: z.number().int().positive() }),
  'notification:markAllRead': z.void(),
  'notification:snooze': z.object({ id: z.number().int().positive(), until: z.number().int().positive() }),
  'notification:clear': z.void(),
  'notification:unreadCount': z.void(),

  'ai:status': z.void(),
  'ai:configure': z.object({ apiKey: z.string().min(1) }),
  'ai:clearKey': z.void(),
  'ai:brief': z.void(),
  'ai:triage': z.void(),

  'extension:list': z.void(),
  'extension:add': z.object({ path: z.string().min(1) }),
  'extension:remove': z.object({ id: idSchema }),
  'extension:setEnabled': z.object({ id: idSchema, enabled: z.boolean() }),

  'import:ferdium': z.object({ data: z.string().min(1), workspaceId: idSchema.optional() }),

  'metrics:get': z.void(),

  'settings:get': z.void(),
  'settings:set': z.object({
    key: z.enum(['theme', 'global_dnd', 'tracker_block', 'close_to_tray', 'global_hotkey', 'onboarded']),
    value: z.string()
  }),

  'update:status': z.void(),
  'update:check': z.void(),
  'update:install': z.void()
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

export function parseIpcPayload<T extends IpcChannel>(channel: T, payload: unknown): z.infer<(typeof ipcSchemas)[T]> {
  const schema = ipcSchemas[channel];
  if (schema instanceof z.ZodVoid) {
    return schema.parse(undefined) as z.infer<(typeof ipcSchemas)[T]>;
  }
  return schema.parse(payload) as z.infer<(typeof ipcSchemas)[T]>;
}
