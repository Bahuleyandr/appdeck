import type { NotificationRecord, ServiceInstance, SleepPolicy } from '../../src/shared/types.js';

let idCounter = 0;

export function makeService(overrides: Partial<ServiceInstance> = {}): ServiceInstance {
  idCounter += 1;
  return {
    id: `svc-${idCounter}`,
    recipe_id: 'recipe-1',
    profile_id: null,
    display_name: `Service ${idCounter}`,
    partition_key: `persist:svc-${idCounter}`,
    color: '#2dd4bf',
    icon_path: null,
    pinned: false,
    muted: false,
    disabled: false,
    sleep_policy: {} satisfies SleepPolicy,
    custom_css: null,
    custom_js: null,
    proxy: null,
    user_agent: null,
    last_url: null,
    zoom_factor: 1,
    spellcheck: true,
    updated_at: 1,
    deleted_at: null,
    rev: 1,
    origin_device: 'test-device',
    ...overrides
  };
}

export function makeNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  idCounter += 1;
  return {
    id: idCounter,
    instance_id: 'svc-1',
    title: `Notification ${idCounter}`,
    body: 'body',
    icon: null,
    created_at: 1_000 + idCounter,
    read_at: null,
    snoozed_until: null,
    ...overrides
  };
}
