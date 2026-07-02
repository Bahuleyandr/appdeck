import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type { ServiceInstance } from '../../shared/types.js';
import { deleteMeta, getMeta, setMeta } from '../db/repositories/meta.js';
import { getServiceInstance, listServiceInstances } from '../db/repositories/serviceInstances.js';

/**
 * Provenance gate for per-service custom CSS/JS. The code itself syncs with the instance record,
 * but approval is a LOCAL fingerprint in the meta table (never exported to the vault), so code
 * written on another device — or injected through a tampered vault — will not execute here until
 * this device's user explicitly approves it. Local edits are approved at the IPC edit site.
 */
const APPROVAL_KEY_PREFIX = 'custom_code_ok:';
const GRANDFATHER_FLAG = 'custom_code_grandfathered';

type CustomCodeCarrier = Pick<ServiceInstance, 'id' | 'custom_css' | 'custom_js'>;

export function customCodeFingerprint(
  css: string | null | undefined,
  js: string | null | undefined
): string | null {
  if (!css && !js) {
    return null;
  }
  const cssPart = css ?? '';
  const jsPart = js ?? '';
  // Length-prefix the CSS so (css, js) boundaries can never be confused.
  return createHash('sha256')
    .update(`${cssPart.length}:`, 'utf8')
    .update(cssPart, 'utf8')
    .update(jsPart, 'utf8')
    .digest('hex');
}

export function isCustomCodeApproved(db: Database.Database, instance: CustomCodeCarrier): boolean {
  const fingerprint = customCodeFingerprint(instance.custom_css, instance.custom_js);
  if (fingerprint === null) {
    return true;
  }
  return getMeta(db, `${APPROVAL_KEY_PREFIX}${instance.id}`) === fingerprint;
}

/** Approve whatever custom code the instance carries right now. */
export function approveCustomCode(db: Database.Database, instanceId: string): void {
  const instance = getServiceInstance(db, instanceId);
  if (!instance) {
    return;
  }
  const fingerprint = customCodeFingerprint(instance.custom_css, instance.custom_js);
  if (fingerprint === null) {
    deleteMeta(db, `${APPROVAL_KEY_PREFIX}${instanceId}`);
    return;
  }
  setMeta(db, `${APPROVAL_KEY_PREFIX}${instanceId}`, fingerprint);
}

export function listPendingCustomCode(
  db: Database.Database
): Array<{ instanceId: string; displayName: string }> {
  return listServiceInstances(db)
    .filter((instance) => !isCustomCodeApproved(db, instance))
    .map((instance) => ({ instanceId: instance.id, displayName: instance.display_name }));
}

/**
 * One-time upgrade shim: code that existed before the gate shipped was already executing, so
 * approve it in place rather than silently breaking it. Runs once per database.
 */
export function grandfatherExistingCustomCode(db: Database.Database): void {
  if (getMeta(db, GRANDFATHER_FLAG)) {
    return;
  }
  for (const instance of listServiceInstances(db, undefined, true)) {
    if (instance.custom_css || instance.custom_js) {
      approveCustomCode(db, instance.id);
    }
  }
  setMeta(db, GRANDFATHER_FLAG, '1');
}
