export const MAX_UNREAD_REGEX_LENGTH = 512;
export const MAX_UNREAD_INPUT_LENGTH = 10_000;

// Patterns come from recipe specs and rarely change; compile each once instead of on every poll.
// Invalid or oversized patterns cache as null so they are not re-tried either.
const compiledPatterns = new Map<string, RegExp | null>();

function compile(pattern: string): RegExp | null {
  const cached = compiledPatterns.get(pattern);
  if (cached !== undefined) {
    return cached;
  }
  let regex: RegExp | null = null;
  if (pattern.length <= MAX_UNREAD_REGEX_LENGTH) {
    try {
      regex = new RegExp(pattern);
    } catch {
      regex = null;
    }
  }
  compiledPatterns.set(pattern, regex);
  return regex;
}

export function execUnreadRegex(pattern: string, input: string): RegExpExecArray | null {
  if (input.length > MAX_UNREAD_INPUT_LENGTH) {
    return null;
  }
  return compile(pattern)?.exec(input) ?? null;
}
