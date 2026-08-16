// Shared setup for the jsdom "renderer" vitest project: registers the jest-dom matchers
// (toBeInTheDocument, toBeDisabled, ...) on vitest's expect.
import '@testing-library/jest-dom/vitest';

// jsdom does not always expose Web Storage — with an identical document origin it is present
// under git-bash and undefined under PowerShell on this host, which broke every test touching
// persisted UI state depending on who ran it. The real renderer is Chromium and always has it,
// so supply a minimal in-memory implementation rather than letting the harness decide.
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();

    get length(): number {
      return this.store.size;
    }

    clear(): void {
      this.store.clear();
    }

    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }

    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }

  for (const name of ['localStorage', 'sessionStorage'] as const) {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, name, { configurable: true, value: storage });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, name, { configurable: true, value: storage });
    }
  }
}
