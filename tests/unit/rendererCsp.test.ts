import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every renderer HTML entry gets its own CSP <meta>. The session-level header CSP registered in
 * createMainWindow is not a reliable second layer for file:// loads in packaged builds, so a new
 * window that ships without a meta tag would run with no effective CSP at all. Discovered when
 * the tray quick-view page shipped without one.
 */
const RENDERER_DIR = new URL('../../src/renderer/', import.meta.url);

function htmlEntries(): string[] {
  return readdirSync(RENDERER_DIR).filter((name) => name.endsWith('.html'));
}

describe('renderer CSP', () => {
  it('finds the html entries it is meant to guard', () => {
    // Without this the suite would vacuously pass if the glob ever stopped matching.
    expect(htmlEntries()).toEqual(expect.arrayContaining(['index.html', 'quickview.html']));
  });

  it.each(htmlEntries())('%s declares a restrictive CSP meta tag', (entry) => {
    const html = readFileSync(new URL(entry, RENDERER_DIR), 'utf8');
    const policy = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i.exec(
      html
    )?.[1];
    // A throw rather than expect(): it fails the test with a readable message *and* narrows the
    // type for the assertions below.
    if (!policy) throw new Error(`${entry} has no Content-Security-Policy meta tag`);
    expect(policy).toMatch(/default-src 'self'/);
    expect(policy).toMatch(/script-src 'self'/);
    // No escape hatches in the script directive: 'unsafe-inline'/'unsafe-eval' there would let
    // injected markup execute, which is the whole thing this policy exists to stop.
    const scriptSrc = /script-src ([^;]+)/.exec(policy)?.[1] ?? '';
    expect(scriptSrc).not.toMatch(/unsafe-(inline|eval)/);
  });
});
