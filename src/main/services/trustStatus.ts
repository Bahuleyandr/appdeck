import type Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerStats, TrustStatus } from '../../shared/types.js';
import { assertVaultHasNoDeniedKeys, buildVaultPlaintext } from '../sync/vault.js';

export function buildTrustStatus(
  db: Database.Database,
  tracker: TrackerStats,
  projectRoot = process.cwd()
): TrustStatus {
  const vault = buildVaultPlaintext(db);
  let safe = true;
  let error: string | null = null;
  try {
    assertVaultHasNoDeniedKeys(vault);
  } catch (caught) {
    safe = false;
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return {
    tracker,
    vault: {
      safe,
      recordCount: vault.records.length,
      error,
      syncs: [
        'workspaces',
        'profiles',
        'custom recipes',
        'service metadata',
        'workspace membership',
        'layouts'
      ],
      neverSyncs: [
        'cookies',
        'tokens',
        'AI keys',
        'proxy passwords',
        'downloads',
        'permission decisions',
        'last visited URLs'
      ]
    },
    release: [
      {
        label: 'Electron Builder config',
        ok: existsSync(join(projectRoot, 'electron-builder.yml')),
        detail: 'Required for signed installer and portable builds.'
      },
      {
        label: 'Release checklist',
        ok: existsSync(join(projectRoot, 'RELEASING.md')),
        detail: 'Documents update, signing, and publishing workflow.'
      },
      {
        label: 'Self-host sync server',
        ok: existsSync(join(projectRoot, 'server', 'wrangler.toml')),
        detail: 'Cloudflare Worker path is present for free sync hosting.'
      },
      {
        label: 'E2E smoke',
        ok: existsSync(join(projectRoot, 'tests', 'e2e', 'app-smoke.spec.ts')),
        detail: 'Release candidate has a runnable shell smoke test.'
      }
    ]
  };
}
