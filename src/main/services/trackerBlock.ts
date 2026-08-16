// Request-level tracker/ad blocking backed by an EasyList + EasyPrivacy engine snapshot
// (@ghostery/adblocker FiltersEngine, cosmetic filtering disabled). The snapshot is built
// at dev time by scripts/update-adblock-engine.mjs, bundled via electron-builder
// extraResources, and loaded lazily off the startup path — requests pass through until
// the engine is ready. Opt-in per the tracker_block setting.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ENGINE_VERSION, FiltersEngine, Request } from '@ghostery/adblocker';
import type { BlocklistInfo, TrackerStats } from '../../shared/types.js';

export const ENGINE_FILENAME = 'adblock-engine.bin';
export const ENGINE_META_FILENAME = 'adblock-engine.meta.json';

// Kept in sync with scripts/update-adblock-engine.mjs: easylist.to is canonical, the
// uAssetsCDN GitHub mirror serves the same compiled lists for networks that block it.
const LIST_SOURCES = [
  {
    name: 'EasyList',
    urls: [
      'https://easylist.to/easylist/easylist.txt',
      'https://raw.githubusercontent.com/uBlockOrigin/uAssetsCDN/main/thirdparties/easylist.txt'
    ]
  },
  {
    name: 'EasyPrivacy',
    urls: [
      'https://easylist.to/easylist/easyprivacy.txt',
      'https://raw.githubusercontent.com/uBlockOrigin/uAssetsCDN/main/thirdparties/easyprivacy.txt'
    ]
  }
];

interface EngineMeta {
  generatedAt: number;
  engineVersion?: number;
  lists?: Array<{ name: string; url?: string; lastModified?: string | null }>;
}

function metaPathFor(binPath: string): string {
  return binPath.replace(/\.bin$/, '.meta.json');
}

async function readMeta(binPath: string): Promise<EngineMeta | null> {
  try {
    const raw = await readFile(metaPathFor(binPath), 'utf8');
    const parsed = JSON.parse(raw) as EngineMeta;
    return typeof parsed.generatedAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export class TrackerBlocker {
  private enabled = false;
  private blockedTotal = 0;
  private readonly blockedByHost = new Map<string, number>();
  private engine: FiltersEngine | null = null;
  private meta: EngineMeta | null = null;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Load the newest available engine snapshot. Candidates are .bin paths (typically the
   * user-updated copy in userData first, then the bundled resource); each may have a
   * sibling .meta.json whose generatedAt decides which snapshot is freshest. A missing or
   * incompatible snapshot leaves the blocker in pass-through mode rather than failing.
   */
  async loadEngine(candidates: string[]): Promise<boolean> {
    const ranked = await Promise.all(
      candidates.map(async (binPath) => ({ binPath, meta: await readMeta(binPath) }))
    );
    ranked.sort((a, b) => (b.meta?.generatedAt ?? 0) - (a.meta?.generatedAt ?? 0));
    for (const candidate of ranked) {
      try {
        const bytes = await readFile(candidate.binPath);
        const started = Date.now();
        const engine = FiltersEngine.deserialize(bytes);
        const elapsed = Date.now() - started;
        this.engine = engine;
        this.meta = candidate.meta;
        console.log(
          `[tracker-block] engine loaded from ${candidate.binPath} in ${elapsed}ms ` +
            `(${bytes.byteLength} bytes)`
        );
        return true;
      } catch (error) {
        // Wrong ENGINE_VERSION (stale userData copy after an app update) or unreadable
        // file: fall through to the next candidate.
        console.warn(
          `[tracker-block] could not load engine from ${candidate.binPath}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
    return false;
  }

  /**
   * User-initiated blocklist refresh: download EasyList + EasyPrivacy, rebuild the engine,
   * persist it to targetDir (userData), and swap it in. Never called automatically — the
   * app does not phone home; see SECURITY.md.
   */
  async updateFromLists(targetDir: string): Promise<BlocklistInfo> {
    const texts: string[] = [];
    const lists: NonNullable<EngineMeta['lists']> = [];
    for (const source of LIST_SOURCES) {
      const { text, url } = await downloadList(source);
      texts.push(text);
      const match = /^! Last modified: (.+)$/m.exec(text);
      lists.push({ name: source.name, url, lastModified: match?.[1]?.trim() ?? null });
    }
    const engine = FiltersEngine.parse(texts.join('\n'), {
      loadCosmeticFilters: false,
      enableCompression: true
    });
    const serialized = engine.serialize();
    const meta: EngineMeta = { generatedAt: Date.now(), engineVersion: ENGINE_VERSION, lists };
    const binPath = join(targetDir, ENGINE_FILENAME);
    // Write-then-rename so a crash mid-write cannot leave a truncated snapshot behind.
    await writeFile(`${binPath}.tmp`, Buffer.from(serialized));
    await rename(`${binPath}.tmp`, binPath);
    await writeFile(join(targetDir, ENGINE_META_FILENAME), JSON.stringify(meta, null, 2));
    this.engine = engine;
    this.meta = meta;
    return this.blocklistInfo();
  }

  /**
   * Pure decision for the shared onBeforeRequest handler in ServiceViewManager. Electron
   * keeps only one listener per webRequest event, so the blocker must not register its
   * own — the firewall handler calls this instead and records hits via recordBlocked.
   * Electron resourceType values ('xhr', 'subFrame', …) are understood by the adblocker's
   * Request normalization; referrer gives the engine the frame origin for $third-party
   * and $domain= filters.
   */
  shouldBlock(url: string, resourceType = 'other', referrer = ''): boolean {
    if (!this.enabled || !this.engine || resourceType === 'mainFrame') {
      // Never cancel top-level navigations; EasyList network filters target subresources.
      return false;
    }
    try {
      const request = Request.fromRawDetails({
        url,
        type: resourceType as Parameters<typeof Request.fromRawDetails>[0]['type'],
        sourceUrl: referrer || undefined
      });
      return this.engine.match(request).match;
    } catch {
      return false;
    }
  }

  recordBlocked(url: string): void {
    this.blockedTotal += 1;
    let host = 'unknown';
    try {
      host = new URL(url).hostname;
    } catch {
      // Keep the aggregate even if parsing fails.
    }
    this.blockedByHost.set(host, (this.blockedByHost.get(host) ?? 0) + 1);
  }

  blocklistInfo(): BlocklistInfo {
    return {
      loaded: this.engine !== null,
      generatedAt: this.meta?.generatedAt ?? null,
      lists: (this.meta?.lists ?? []).map((list) => list.name)
    };
  }

  stats(): TrackerStats {
    return {
      enabled: this.enabled,
      blockedTotal: this.blockedTotal,
      topHosts: [...this.blockedByHost.entries()]
        .map(([host, count]) => ({ host, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      blocklist: this.blocklistInfo()
    };
  }
}

async function downloadList(source: {
  name: string;
  urls: string[];
}): Promise<{ text: string; url: string }> {
  let lastError: unknown = null;
  for (const url of source.urls) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      if (!text.includes('[Adblock')) {
        throw new Error('not an Adblock Plus list');
      }
      return { text, url };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not download ${source.name}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
