import type Database from 'better-sqlite3';
import type { WorkKit } from '../../shared/types.js';
import { createCustomRecipe } from '../db/repositories/customRecipes.js';
import { upsertFocusMode } from '../db/repositories/focusModes.js';
import { upsertAiPrompt } from '../db/repositories/aiPrompts.js';
import { createServiceInstance } from '../db/repositories/serviceInstances.js';
import { createWorkspace } from '../db/repositories/workspaces.js';
import { getWorkKit } from '../db/repositories/workKits.js';

export function applyWorkKit(
  db: Database.Database,
  deviceId: string,
  id: string
): { workspaceId: string; createdServices: number; kit: WorkKit } {
  const kit = getWorkKit(db, id);
  if (!kit) throw new Error('Work kit not found');
  const workspace = createWorkspace(db, deviceId, {
    name: kit.payload.workspaceName,
    icon: 'briefcase',
    color: '#2dd4bf'
  });
  let createdServices = 0;
  for (const service of kit.payload.services) {
    const host = hostOf(service.url);
    if (!host) continue;
    const recipe = createCustomRecipe(db, deviceId, {
      name: service.name,
      category: service.category,
      start_url: service.url,
      allowed_domains: [host, host.replace(/^www\./, '')]
    });
    createServiceInstance(db, deviceId, {
      recipeId: recipe.id,
      workspaceId: workspace.id,
      displayName: service.name
    });
    createdServices += 1;
  }
  for (const prompt of kit.payload.aiPrompts ?? []) {
    upsertAiPrompt(db, {
      title: prompt.title,
      prompt: prompt.prompt,
      local_only: true
    });
  }
  if (kit.payload.focusMode) {
    upsertFocusMode(db, {
      name: kit.payload.focusMode.name ?? `${kit.name} Focus`,
      workspace_id: workspace.id,
      settings: kit.payload.focusMode.settings ?? { muteNotifications: true },
      schedule: kit.payload.focusMode.schedule ?? []
    });
  }
  return { workspaceId: workspace.id, createdServices, kit };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
