// Regenerates the bundled adblock engine snapshot from EasyList + EasyPrivacy.
//
// Usage:
//   npm run update:adblock                 # download lists and rebuild resources/adblock-engine.bin
//   node scripts/update-adblock-engine.mjs path/to/easylist.txt path/to/easyprivacy.txt
//                                          # build from pre-downloaded list files (offline/proxied CI)
//
// The snapshot is a serialized @ghostery/adblocker FiltersEngine with cosmetic filters
// disabled (AppDeck only does request-level blocking). It is loaded at startup by
// TrackerBlocker and packed into installers via electron-builder extraResources.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION, FiltersEngine } from '@ghostery/adblocker';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'resources');

// Primary source is easylist.to; the uAssetsCDN GitHub mirror carries the same compiled
// lists and is the fallback for networks where easylist.to is unreachable.
const LISTS = [
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

async function fetchList(list) {
  let lastError = null;
  for (const url of list.urls) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      if (!text.includes('[Adblock')) {
        throw new Error('response does not look like an Adblock Plus list');
      }
      console.log(`Fetched ${list.name} from ${url} (${text.length} bytes)`);
      return { text, url };
    } catch (error) {
      lastError = error;
      console.warn(`Failed ${list.name} from ${url}: ${error.message}`);
    }
  }
  throw new Error(`Could not download ${list.name}: ${lastError?.message}`);
}

function lastModifiedOf(text) {
  const match = text.match(/^! Last modified: (.+)$/m);
  return match ? match[1].trim() : null;
}

async function main() {
  const localFiles = process.argv.slice(2);
  const sources = [];
  if (localFiles.length) {
    if (localFiles.length !== LISTS.length) {
      throw new Error(`Expected ${LISTS.length} local list files (EasyList, EasyPrivacy)`);
    }
    for (const [index, file] of localFiles.entries()) {
      const text = await readFile(file, 'utf8');
      console.log(`Read ${LISTS[index].name} from ${file} (${text.length} bytes)`);
      sources.push({ name: LISTS[index].name, url: LISTS[index].urls[0], text });
    }
  } else {
    for (const list of LISTS) {
      const { text, url } = await fetchList(list);
      sources.push({ name: list.name, url, text });
    }
  }

  const combined = sources.map((source) => source.text).join('\n');
  const started = Date.now();
  // Request blocking only: cosmetic filters are out of scope and skipping them keeps the
  // snapshot (and per-request matching) small.
  const engine = FiltersEngine.parse(combined, {
    loadCosmeticFilters: false,
    enableCompression: true
  });
  const serialized = engine.serialize();
  console.log(`Built engine in ${Date.now() - started}ms (${serialized.byteLength} bytes)`);

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'adblock-engine.bin'), Buffer.from(serialized));
  const meta = {
    generatedAt: Date.now(),
    engineVersion: ENGINE_VERSION,
    sizeBytes: serialized.byteLength,
    lists: sources.map((source) => ({
      name: source.name,
      url: source.url,
      lastModified: lastModifiedOf(source.text)
    }))
  };
  await writeFile(join(outDir, 'adblock-engine.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`Wrote ${join(outDir, 'adblock-engine.bin')}`);
  console.log(JSON.stringify(meta, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
