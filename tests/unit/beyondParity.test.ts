import { describe, expect, it } from 'vitest';
import {
  listAutomations,
  testAutomation,
  upsertAutomation
} from '../../src/main/db/repositories/automations.js';
import { listFocusModes, upsertFocusMode } from '../../src/main/db/repositories/focusModes.js';
import {
  testFirewallRules,
  upsertFirewallRule
} from '../../src/main/db/repositories/privacyFirewall.js';
import { listWorkKits } from '../../src/main/db/repositories/workKits.js';
import { previewBrowserImport } from '../../src/main/services/browserImport.js';
import {
  analyzeRecipeDraft,
  createRecipeFromStudio
} from '../../src/main/services/recipeStudio.js';
import { RecipeLoader } from '../../src/main/recipes/loader.js';
import { createTestDb } from './helpers.js';

describe('beyond-parity foundations', () => {
  it('stores and tests local automation rules', () => {
    const { db } = createTestDb();
    const rule = upsertAutomation(db, {
      name: 'Urgent mail to task',
      trigger: { type: 'notification', matchText: 'urgent' },
      actions: [{ type: 'createTask', value: 'Follow up' }]
    });

    expect(listAutomations(db)[0]?.id).toBe(rule.id);
    expect(
      testAutomation(rule, { title: 'Urgent customer note', body: '', unread: 1 }).matched
    ).toBe(true);
  });

  it('stores focus modes with schedules and settings', () => {
    const { db } = createTestDb();
    const mode = upsertFocusMode(db, {
      name: 'Deep Work',
      schedule: [{ from: '09:00', to: '12:00', days: [1, 2, 3, 4, 5] }],
      settings: { muteNotifications: true, hideMutedServices: true }
    });

    expect(listFocusModes(db)[0]?.id).toBe(mode.id);
    expect(mode.settings.muteNotifications).toBe(true);
  });

  it('previews browser bookmark HTML imports', () => {
    const { db } = createTestDb();
    const preview = previewBrowserImport(
      '<DL><DT><H3>Work</H3><DT><A HREF="https://github.com/Bahuleyandr/appdeck">AppDeck</A></DL>',
      new RecipeLoader(db)
    );

    expect(preview.total).toBe(1);
    expect(preview.importable).toBe(1);
    expect(preview.items[0]?.recipeId).toBeTruthy();
  });

  it('analyzes and creates recipe-studio registry entries', () => {
    const { db } = createTestDb();
    const analysis = analyzeRecipeDraft({
      name: 'Example Tool',
      url: 'https://tool.example.com/app',
      category: 'Dev'
    });

    expect(analysis.valid).toBe(true);
    const recipe = createRecipeFromStudio(db, {
      name: 'Example Tool',
      url: 'https://tool.example.com/app',
      category: 'Dev'
    });
    expect(recipe.allowed_domains).toContain('tool.example.com');
  });

  it('tests privacy firewall rules and seeds work kits', () => {
    const { db } = createTestDb();
    upsertFirewallRule(db, {
      rule_type: 'domain',
      pattern: 'tracker.example.com',
      action: 'block'
    });

    expect(testFirewallRules(db, 'https://tracker.example.com/pixel.gif').action).toBe('block');
    expect(listWorkKits(db).length).toBeGreaterThanOrEqual(3);
  });
});
