import { describe, expect, it } from 'vitest';
import {
  execUnreadRegex,
  MAX_UNREAD_INPUT_LENGTH,
  MAX_UNREAD_REGEX_LENGTH
} from '../../src/preload/unread.js';

describe('unread regex guard', () => {
  it('returns matches for valid unread patterns', () => {
    expect(execUnreadRegex('\\((\\d+)\\)', 'Inbox (12)')?.[1]).toBe('12');
  });

  it('rejects invalid or oversized unread regexes', () => {
    expect(execUnreadRegex('(', 'Inbox (12)')).toBeNull();
    expect(execUnreadRegex('a'.repeat(MAX_UNREAD_REGEX_LENGTH + 1), 'Inbox (12)')).toBeNull();
  });

  it('rejects oversized unread input before running a regex', () => {
    expect(execUnreadRegex('(\\d+)', '1'.repeat(MAX_UNREAD_INPUT_LENGTH + 1))).toBeNull();
  });
});
