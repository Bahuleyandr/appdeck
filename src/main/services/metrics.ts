import { app } from 'electron';
import type { AppMetrics } from '../../shared/types.js';

// RAM usage across all AppDeck processes (each sleeping service frees its renderer).
// Exposed so the app can show — and be held accountable for — its memory footprint.
export function collectMetrics(): AppMetrics {
  const processes = app.getAppMetrics().map((metric) => ({
    type: metric.type,
    name: metric.name ?? metric.serviceName ?? metric.type,
    memoryMB: Math.round((metric.memory?.workingSetSize ?? 0) / 1024)
  }));
  const totalMemoryMB = processes.reduce((sum, process) => sum + process.memoryMB, 0);
  processes.sort((a, b) => b.memoryMB - a.memoryMB);
  return { totalMemoryMB, processes: processes.slice(0, 16) };
}
