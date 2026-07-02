import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getAppMetrics: vi.fn(() => []) } }));

import { joinServiceMemory } from '../../src/main/services/metrics.js';

const INSTANCES = [
  { id: 'a', display_name: 'Alpha' },
  { id: 'b', display_name: 'Beta' },
  { id: 'c', display_name: 'Gamma' }
];

describe('per-service memory accounting', () => {
  it('joins live pids to OS metrics and zeroes slept services', () => {
    const rows = joinServiceMemory(
      INSTANCES,
      [
        { instanceId: 'a', pid: 101, dozing: false },
        { instanceId: 'b', pid: 102, dozing: true }
      ],
      [
        { pid: 101, memoryKB: 512_000 },
        { pid: 102, memoryKB: 256_000 },
        { pid: 999, memoryKB: 64_000 }
      ]
    );

    expect(rows).toEqual([
      { instanceId: 'a', displayName: 'Alpha', memoryMB: 500, state: 'active' },
      { instanceId: 'b', displayName: 'Beta', memoryMB: 250, state: 'dozing' },
      { instanceId: 'c', displayName: 'Gamma', memoryMB: 0, state: 'sleeping' }
    ]);
  });

  it('sums multiple views of one instance into a single row', () => {
    const rows = joinServiceMemory(
      [{ id: 'a', display_name: 'Alpha' }],
      [
        { instanceId: 'a', pid: 101, dozing: false },
        { instanceId: 'a', pid: 102, dozing: false }
      ],
      [
        { pid: 101, memoryKB: 100_000 },
        { pid: 102, memoryKB: 50_000 }
      ]
    );

    expect(rows).toEqual([
      { instanceId: 'a', displayName: 'Alpha', memoryMB: 147, state: 'active' }
    ]);
  });
});
