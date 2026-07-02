import { app } from 'electron';
import type Database from 'better-sqlite3';
import type { AppMetrics, PerformanceStatus, ServiceMemoryRow } from '../../shared/types.js';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';
import type { ServiceViewManager } from '../views/serviceViewManager.js';

/**
 * Attribute OS process memory to service instances. Per-pid MB is rounded before summing so a
 * service's number matches what the raw process list shows. Services with no live renderer
 * report 0 MB and state 'sleeping' — that zero IS the feature.
 */
export function joinServiceMemory(
  instances: Array<{ id: string; display_name: string }>,
  pids: Array<{ instanceId: string; pid: number; dozing: boolean }>,
  osMetrics: Array<{ pid: number; memoryKB: number }>
): ServiceMemoryRow[] {
  const memoryByPid = new Map(osMetrics.map((metric) => [metric.pid, metric.memoryKB]));
  return instances.map((instance) => {
    const owned = pids.filter((entry) => entry.instanceId === instance.id);
    const memoryMB = owned.reduce(
      (sum, entry) => sum + Math.round((memoryByPid.get(entry.pid) ?? 0) / 1024),
      0
    );
    const state: ServiceMemoryRow['state'] = !owned.length
      ? 'sleeping'
      : owned.every((entry) => entry.dozing)
        ? 'dozing'
        : 'active';
    return {
      instanceId: instance.id,
      displayName: instance.display_name,
      memoryMB: state === 'sleeping' ? 0 : memoryMB,
      state
    };
  });
}

// RAM usage across all AppDeck processes (each sleeping service frees its renderer).
// Exposed so the app can show — and be held accountable for — its memory footprint.
export function collectMetrics(
  db?: Database.Database,
  viewManager?: ServiceViewManager
): AppMetrics {
  const raw = app.getAppMetrics();
  const processes = raw.map((metric) => ({
    type: metric.type,
    name: metric.name ?? metric.serviceName ?? metric.type,
    memoryMB: Math.round((metric.memory?.workingSetSize ?? 0) / 1024)
  }));
  const totalMemoryMB = processes.reduce((sum, process) => sum + process.memoryMB, 0);
  processes.sort((a, b) => b.memoryMB - a.memoryMB);
  const metrics: AppMetrics = { totalMemoryMB, processes: processes.slice(0, 16) };
  if (db && viewManager) {
    const services = joinServiceMemory(
      listServiceInstances(db),
      viewManager.processIds(),
      raw.map((metric) => ({ pid: metric.pid, memoryKB: metric.memory?.workingSetSize ?? 0 }))
    );
    for (const row of services) {
      if (row.state !== 'sleeping') {
        viewManager.recordMemory(row.instanceId, row.memoryMB);
      }
    }
    metrics.services = services.sort((a, b) => b.memoryMB - a.memoryMB);
    metrics.estimatedSavedMB = viewManager.estimatedSavedMB();
  }
  return metrics;
}

export function collectPerformanceStatus(
  db: Database.Database,
  viewManager?: ServiceViewManager
): PerformanceStatus {
  const metrics = collectMetrics(db, viewManager);
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
