import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { APPDECK_VAULT_FILE, VAULT_MAGIC, VAULT_VERSION } from '../../shared/constants.js';
import type { SyncRecord, VaultPlaintext } from '../../shared/types.js';
import { listCustomRecipes } from '../db/repositories/customRecipes.js';
import { listLayouts } from '../db/repositories/layouts.js';
import { listProfiles } from '../db/repositories/profiles.js';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';
import { listWorkspaceServices } from '../db/repositories/workspaceServices.js';
import { listWorkspaces } from '../db/repositories/workspaces.js';
import { decryptWithRootKey, encryptWithRootKey } from './crypto.js';

const vaultPlaintextSchema = z.object({
  schemaVersion: z.number().int().positive(),
  records: z.array(
    z.object({
      type: z.enum([
        'workspace',
        'profile',
        'customRecipe',
        'serviceInstance',
        'workspaceService',
        'layout'
      ]),
      id: z.string(),
      rev: z.number().int(),
      updatedAt: z.number().int(),
      deletedAt: z.number().int().nullable(),
      originDevice: z.string(),
      data: z.record(z.string(), z.unknown())
    })
  )
});

export function buildVaultPlaintext(db: Database.Database): VaultPlaintext {
  const records: SyncRecord[] = [];
  for (const workspace of listWorkspaces(db, true)) {
    records.push({
      type: 'workspace',
      id: workspace.id,
      rev: workspace.rev,
      updatedAt: workspace.updated_at,
      deletedAt: workspace.deleted_at,
      originDevice: workspace.origin_device,
      data: {
        id: workspace.id,
        parent_id: workspace.parent_id,
        name: workspace.name,
        icon: workspace.icon,
        color: workspace.color,
        position: workspace.position,
        disabled: workspace.disabled,
        focus_rules: workspace.focus_rules,
        sleep_defaults: workspace.sleep_defaults
      }
    });
  }
  for (const profile of listProfiles(db, true)) {
    records.push({
      type: 'profile',
      id: profile.id,
      rev: profile.rev,
      updatedAt: profile.updated_at,
      deletedAt: profile.deleted_at,
      originDevice: profile.origin_device,
      data: { id: profile.id, label: profile.label, color: profile.color }
    });
  }
  for (const recipe of listCustomRecipes(db, true)) {
    records.push({
      type: 'customRecipe',
      id: recipe.id,
      rev: recipe.rev,
      updatedAt: recipe.updated_at,
      deletedAt: recipe.deleted_at,
      originDevice: recipe.origin_device,
      data: {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        start_url: recipe.start_url,
        allowed_domains: recipe.allowed_domains,
        icon_path: recipe.icon_path,
        default_user_agent: recipe.default_user_agent,
        unread_spec: recipe.unread_spec,
        mobile_mode: recipe.mobile_mode
      }
    });
  }
  for (const instance of listServiceInstances(db, undefined, true)) {
    records.push({
      type: 'serviceInstance',
      id: instance.id,
      rev: instance.rev,
      updatedAt: instance.updated_at,
      deletedAt: instance.deleted_at,
      originDevice: instance.origin_device,
      data: {
        id: instance.id,
        recipe_id: instance.recipe_id,
        profile_id: instance.profile_id,
        display_name: instance.display_name,
        partition_key: instance.partition_key,
        color: instance.color,
        icon_path: instance.icon_path,
        pinned: instance.pinned,
        muted: instance.muted,
        disabled: instance.disabled,
        sleep_policy: instance.sleep_policy,
        custom_css: instance.custom_css,
        custom_js: instance.custom_js,
        proxy: instance.proxy,
        user_agent: instance.user_agent,
        zoom_factor: instance.zoom_factor,
        spellcheck: instance.spellcheck
      }
    });
  }
  for (const membership of listWorkspaceServices(db, true)) {
    const id = `${membership.workspace_id}:${membership.service_instance_id}`;
    records.push({
      type: 'workspaceService',
      id,
      rev: membership.rev,
      updatedAt: membership.updated_at,
      deletedAt: membership.deleted_at,
      originDevice: membership.origin_device,
      data: {
        workspace_id: membership.workspace_id,
        service_instance_id: membership.service_instance_id,
        position: membership.position,
        group_name: membership.group_name
      }
    });
  }
  for (const layout of listLayouts(db, true)) {
    records.push({
      type: 'layout',
      id: layout.workspace_id,
      rev: layout.rev,
      updatedAt: layout.updated_at,
      deletedAt: layout.deleted_at,
      originDevice: layout.origin_device,
      data: {
        workspace_id: layout.workspace_id,
        mode: layout.mode,
        selected_service_ids: layout.selected_service_ids,
        tile_sizing: layout.tile_sizing
      }
    });
  }
  return { schemaVersion: 1, records };
}

// File layout: magic(8) | version(1) | nonce(24) | ciphertext. AAD = magic|version.
const NONCE_OFFSET = 9;
const CIPHERTEXT_OFFSET = 33;

export async function encryptVault(db: Database.Database, rootKey: Uint8Array): Promise<Buffer> {
  const vault = buildVaultPlaintext(db);
  assertVaultHasNoDeniedKeys(vault);
  const plaintext = Buffer.from(JSON.stringify(vault), 'utf8');
  const magic = Buffer.from(VAULT_MAGIC, 'ascii');
  const aad = Buffer.concat([magic, Buffer.from([VAULT_VERSION])]);
  const encrypted = await encryptWithRootKey(rootKey, plaintext, aad);
  return Buffer.concat([
    magic,
    Buffer.from([VAULT_VERSION]),
    Buffer.from(encrypted.nonce),
    Buffer.from(encrypted.ciphertext)
  ]);
}

export async function decryptVault(bytes: Buffer, rootKey: Uint8Array): Promise<VaultPlaintext> {
  const magic = bytes.subarray(0, 8);
  if (magic.toString('ascii') !== VAULT_MAGIC) {
    throw new Error('Invalid AppDeck vault');
  }
  const version = bytes.readUInt8(8);
  if (version !== VAULT_VERSION) {
    throw new Error(`Unsupported vault version: ${version}`);
  }
  const nonce = bytes.subarray(NONCE_OFFSET, CIPHERTEXT_OFFSET);
  const ciphertext = bytes.subarray(CIPHERTEXT_OFFSET);
  const aad = bytes.subarray(0, 9);
  const plaintext = await decryptWithRootKey(rootKey, ciphertext, nonce, aad);
  return vaultPlaintextSchema.parse(JSON.parse(Buffer.from(plaintext).toString('utf8')));
}

/** Stable hash of vault *content* (not ciphertext) so sync can detect convergence. */
export function vaultContentHash(plaintext: VaultPlaintext): string {
  const canonical = [...plaintext.records]
    .sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`))
    .map((record) => ({
      t: record.type,
      i: record.id,
      r: record.rev,
      u: record.updatedAt,
      d: record.deletedAt,
      o: record.originDevice,
      data: record.data
    }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function localVaultHash(db: Database.Database): string {
  return vaultContentHash(buildVaultPlaintext(db));
}

export async function writeVaultFile(
  db: Database.Database,
  rootKey: Uint8Array,
  targetPath: string
): Promise<void> {
  const bytes = await encryptVault(db, rootKey);
  const tempPath = join(dirname(targetPath), `.appdeck-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tempPath, bytes);
  renameSync(tempPath, targetPath);
}

export async function readVaultFile(
  sourcePath: string,
  rootKey: Uint8Array
): Promise<VaultPlaintext> {
  return decryptVault(readFileSync(sourcePath), rootKey);
}

export function vaultPathForFolder(folderPath: string): string {
  return join(folderPath, APPDECK_VAULT_FILE);
}

// Denies by KEY NAME (not value) so legitimate data — a service named "Cookie Clicker",
// a workspace "Token Ring" — never trips it. partition_key is intentionally synced.
const DENIED_EXACT_KEYS = new Set(['last_url', 'device_id']);
const DENIED_KEY_FRAGMENTS = ['cookie', 'password', 'token', 'secret', 'safestorage'];

export function assertVaultHasNoDeniedKeys(plaintext: VaultPlaintext): void {
  for (const record of plaintext.records) {
    assertObjectKeysSafe(record.data, `${record.type}:${record.id}`);
  }
}

function assertObjectKeysSafe(value: unknown, path: string): void {
  if (value === null || typeof value !== 'object') {
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (
      DENIED_EXACT_KEYS.has(key) ||
      DENIED_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment))
    ) {
      throw new Error(`Vault contains denied key "${key}" at ${path}`);
    }
    assertObjectKeysSafe(child, `${path}.${key}`);
  }
}
