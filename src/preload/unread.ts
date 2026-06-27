export const MAX_UNREAD_REGEX_LENGTH = 512;
export const MAX_UNREAD_INPUT_LENGTH = 10_000;

export function execUnreadRegex(pattern: string, input: string): RegExpExecArray | null {
  if (pattern.length > MAX_UNREAD_REGEX_LENGTH || input.length > MAX_UNREAD_INPUT_LENGTH) {
    return null;
  }
  try {
    return new RegExp(pattern).exec(input);
  } catch {
    return null;
  }
}
