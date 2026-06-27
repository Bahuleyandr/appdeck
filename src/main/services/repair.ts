import type Database from 'better-sqlite3';
import { isHttpUrl } from '../../shared/ipc-contract.js';
import type { RepairResult, RepairStatus } from '../../shared/types.js';
import {
  listServiceInstances,
  updateServiceInstance
} from '../db/repositories/serviceInstances.js';
import type { RecipeLoader } from '../recipes/loader.js';

export function buildRepairStatus(db: Database.Database, recipeLoader: RecipeLoader): RepairStatus {
  const integrityMessages = integrityCheck(db);
  const invalidLastUrls: string[] = [];
  const missingRecipes: string[] = [];
  for (const service of listServiceInstances(db, undefined, true)) {
    if (service.last_url && !isHttpUrl(service.last_url)) {
      invalidLastUrls.push(service.id);
    }
    try {
      recipeLoader.resolveForInstance(service);
    } catch {
      missingRecipes.push(service.id);
    }
  }
  return {
    integrityOk: integrityMessages.length === 1 && integrityMessages[0] === 'ok',
    integrityMessages,
    invalidLastUrls,
    missingRecipes,
    safeModeRecommended: integrityMessages[0] !== 'ok' || missingRecipes.length > 0
  };
}

export function runRepair(
  db: Database.Database,
  deviceId: string,
  recipeLoader: RecipeLoader
): RepairResult {
  const before = buildRepairStatus(db, recipeLoader);
  let fixed = 0;
  for (const id of before.invalidLastUrls) {
    db.prepare('UPDATE service_instances SET last_url = NULL WHERE id = ?').run(id);
    fixed += 1;
  }
  for (const id of before.missingRecipes) {
    const service = listServiceInstances(db, undefined, true).find(
      (candidate) => candidate.id === id
    );
    if (service && !service.disabled) {
      updateServiceInstance(db, deviceId, id, { disabled: true });
      fixed += 1;
    }
  }
  return { ...buildRepairStatus(db, recipeLoader), fixed };
}

function integrityCheck(db: Database.Database): string[] {
  const rows = db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>;
  return rows.map((row) => row.integrity_check);
}
