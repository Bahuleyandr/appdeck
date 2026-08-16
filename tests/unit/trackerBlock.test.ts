import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { TrackerBlocker } from '../../src/main/services/trackerBlock.js';

const BUNDLED_ENGINE = join(process.cwd(), 'resources', 'adblock-engine.bin');
const PAGE = 'https://example.com/';

describe('tracker blocker (EasyList+EasyPrivacy engine)', () => {
  let blocker: TrackerBlocker;

  beforeAll(async () => {
    blocker = new TrackerBlocker();
    const loaded = await blocker.loadEngine([BUNDLED_ENGINE]);
    expect(loaded).toBe(true);
  });

  it('blocks known tracker/ad requests from the bundled snapshot', () => {
    blocker.setEnabled(true);
    expect(
      blocker.shouldBlock('https://www.google-analytics.com/analytics.js', 'script', PAGE)
    ).toBe(true);
    expect(
      blocker.shouldBlock('https://www.googletagmanager.com/gtag/js?id=G-1', 'script', PAGE)
    ).toBe(true);
    expect(
      blocker.shouldBlock('https://connect.facebook.net/en_US/fbevents.js', 'script', PAGE)
    ).toBe(true);
  });

  it('passes benign first-party requests through', () => {
    blocker.setEnabled(true);
    expect(blocker.shouldBlock('https://example.com/app.js', 'script', PAGE)).toBe(false);
    expect(blocker.shouldBlock('https://example.com/styles.css', 'stylesheet', PAGE)).toBe(false);
    expect(blocker.shouldBlock('https://web.whatsapp.com/', 'mainFrame')).toBe(false);
  });

  it('never cancels top-level navigations, even to tracker hosts', () => {
    blocker.setEnabled(true);
    expect(blocker.shouldBlock('https://www.google-analytics.com/', 'mainFrame')).toBe(false);
  });

  it('passes everything through when disabled', () => {
    blocker.setEnabled(false);
    expect(
      blocker.shouldBlock('https://www.google-analytics.com/analytics.js', 'script', PAGE)
    ).toBe(false);
  });

  it('passes everything through before the engine snapshot is loaded', () => {
    const cold = new TrackerBlocker();
    cold.setEnabled(true);
    expect(cold.shouldBlock('https://www.google-analytics.com/analytics.js', 'script', PAGE)).toBe(
      false
    );
    expect(cold.stats().blocklist.loaded).toBe(false);
  });

  it('survives malformed URLs and reports blocklist metadata in stats', () => {
    blocker.setEnabled(true);
    expect(blocker.shouldBlock('not a url', 'script')).toBe(false);
    const stats = blocker.stats();
    expect(stats.blocklist.loaded).toBe(true);
    expect(stats.blocklist.lists).toEqual(['EasyList', 'EasyPrivacy']);
    expect(stats.blocklist.generatedAt).toBeTypeOf('number');
  });

  it('ignores missing or corrupt snapshot candidates and stays in pass-through', async () => {
    const broken = new TrackerBlocker();
    const loaded = await broken.loadEngine([
      join(process.cwd(), 'resources', 'no-such-engine.bin'),
      join(process.cwd(), 'package.json')
    ]);
    expect(loaded).toBe(false);
    broken.setEnabled(true);
    expect(
      broken.shouldBlock('https://www.google-analytics.com/analytics.js', 'script', PAGE)
    ).toBe(false);
  });
});
