import type { JSX } from 'react';
import { useState } from 'react';
import type {
  AppMetrics,
  RepairStatus
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { Metric } from './helpers';

export function DiagnosticsPanel({
  metrics,
  setMetrics,
  repairStatus,
  setRepairStatus
}: {
  metrics: AppMetrics | null;
  setMetrics: (metrics: AppMetrics) => void;
  repairStatus: RepairStatus | null;
  setRepairStatus: (status: RepairStatus) => void;
}): JSX.Element {
  const [repairResult, setRepairResult] = useState('');
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Runtime</div>
          <button className="app-button" onClick={() => void api.metrics.get().then(setMetrics)}>
            Refresh
          </button>
        </div>
        <div className="mb-3 text-sm">Memory: {metrics ? `${metrics.totalMemoryMB} MB` : '-'}</div>
        <div className="space-y-1">
          {metrics?.processes.map((process, index) => (
            <div
              key={`${process.type}-${process.name}-${index}`}
              className="grid grid-cols-[120px_1fr_80px] gap-2 rounded-md border border-line px-2 py-1 text-xs"
            >
              <span className="truncate text-muted">{process.type}</span>
              <span className="truncate">{process.name}</span>
              <span className="text-right">{process.memoryMB} MB</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Repair</div>
          <div className="flex gap-2">
            <button
              className="app-button"
              onClick={() => void api.repair.status().then(setRepairStatus)}
            >
              Check
            </button>
            <button
              className="app-button primary"
              onClick={() =>
                void api.repair.run().then((result) => {
                  setRepairStatus(result);
                  setRepairResult(`Fixed ${result.fixed} issues.`);
                })
              }
            >
              Repair
            </button>
          </div>
        </div>
        <div className="grid gap-2 text-xs lg:grid-cols-4">
          <Metric label="DB" value={repairStatus?.integrityOk ? 'OK' : 'Check'} />
          <Metric label="Bad URLs" value={String(repairStatus?.invalidLastUrls.length ?? 0)} />
          <Metric
            label="Missing Recipes"
            value={String(repairStatus?.missingRecipes.length ?? 0)}
          />
          <Metric
            label="Safe Mode"
            value={repairStatus?.safeModeRecommended ? 'Recommended' : 'Not needed'}
          />
        </div>
        {repairResult && <div className="mt-3 text-xs text-muted">{repairResult}</div>}
        {repairStatus?.integrityMessages.some((message) => message !== 'ok') ? (
          <div className="mt-3 space-y-1 text-xs text-muted">
            {repairStatus.integrityMessages.map((message) => (
              <div key={message} className="rounded-md border border-line p-2">
                {message}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
