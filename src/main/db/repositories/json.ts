export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export function toBool(value: number | boolean): boolean {
  return value === true || value === 1;
}

export function boolInt(value: boolean | undefined): number | undefined {
  return typeof value === 'boolean' ? (value ? 1 : 0) : undefined;
}
