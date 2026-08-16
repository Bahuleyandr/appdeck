import type { JSX } from 'react';
import type {
  PersonalAnalytics
} from '../../../shared/types';
import { EmptyState, Metric } from './helpers';

export function AnalyticsPanel({
  analytics,
  refresh
}: {
  analytics: PersonalAnalytics | null;
  refresh: () => void;
}): JSX.Element {
  if (!analytics) return <EmptyState label="Loading analytics." />;
  return (
    <section className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-4">
        <Metric label="Services" value={String(analytics.activeServices)} />
        <Metric label="Unread" value={String(analytics.unreadTotal)} />
        <Metric label="Open Tasks" value={String(analytics.openTasks)} />
        <Metric label="Trackers Blocked" value={String(analytics.trackerBlocks.blockedTotal)} />
      </div>
      <button className="app-button" onClick={refresh}>
        Refresh
      </button>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel rounded-md p-3">
          <div className="mb-2 text-sm font-semibold">Noisy Services</div>
          {analytics.noisyServices.map((service) => (
            <div
              key={service.serviceId}
              className="flex justify-between border-b border-line py-2 text-sm last:border-b-0"
            >
              <span>{service.name}</span>
              <span className="text-muted">{service.notifications}</span>
            </div>
          ))}
        </div>
        <div className="panel rounded-md p-3">
          <div className="mb-2 text-sm font-semibold">Memory Leaders</div>
          {analytics.memoryTop.map((process) => (
            <div
              key={`${process.type}-${process.name}`}
              className="flex justify-between border-b border-line py-2 text-sm last:border-b-0"
            >
              <span className="truncate">{process.name || process.type}</span>
              <span className="text-muted">{process.memoryMB} MB</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
