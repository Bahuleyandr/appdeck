import { app } from 'electron';
import type Database from 'better-sqlite3';
import type { AppMetrics, PerformanceStatus } from '../../shared/types.js';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';

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

export function collectPerformanceStatus(db: Database.Database): PerformanceStatus {
  const metrics = collectMetrics();
  const services = listServiceInstances(db);
  const disabled = services.filter((service) => service.disabled);
  const suggestions: PerformanceStatus['suggestions'] = [];
  if (metrics.totalMemoryMB > 1200) {
    suggestions.push({
      level: 'warning',
      title: 'High memory use',
      detail:
        'Use workspace sleep defaults, disable dormant apps, or switch heavy services to launcher mode.'
    });
  }
  if (services.length > 12 && disabled.length === 0) {
    suggestions.push({
      level: 'info',
      title: 'Add sleep budgets',
      detail: 'Large workspaces benefit from per-service idle sleep and pinned-only wake groups.'
    });
  }
  const heaviest = metrics.processes[0];
  if (heaviest && heaviest.memoryMB > 400) {
    suggestions.push({
      level: 'warning',
      title: `${heaviest.name} is heavy`,
      detail: `This process is using ${heaviest.memoryMB} MB. Sleep or reload its service if it is idle.`
    });
  }
  return {
    ...metrics,
    serviceCount: services.length,
    disabledServiceCount: disabled.length,
    suggestions
  };
}
