import type { JSX } from 'react';
import type { PortableModeStatus } from '../../../shared/types';

/**
 * Portable mode is switched on by a marker file beside the executable, not from in here: the
 * database that would store such a setting lives inside the directory being chosen. So this
 * panel reports the real state and explains how to change it.
 */
export function PortablePanel({ status }: { status: PortableModeStatus | null }): JSX.Element {
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">AppDeck Portable Mode</div>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              status?.active ? 'bg-accent/20 text-ink' : 'bg-elevated text-muted'
            }`}
          >
            {status?.active ? 'Active' : 'Off'}
          </span>
        </div>
        <div className="space-y-2 text-xs">
          <div>
            <div className="mb-1 text-muted">Data directory (in use right now)</div>
            <div className="break-all rounded-md border border-line p-2 font-mono">
              {status?.dataDirectory ?? '—'}
            </div>
          </div>
          <div>
            <div className="mb-1 text-muted">Marker file that turns it on</div>
            <div className="break-all rounded-md border border-line p-2 font-mono">
              {status?.markerPath ?? '—'}
            </div>
          </div>
          <div>
            <div className="mb-1 text-muted">Environment override</div>
            <div className="break-all rounded-md border border-line p-2 font-mono">
              {status?.envVar ?? '—'}
            </div>
          </div>
        </div>
      </div>
      <div className="panel rounded-md p-3 text-xs text-muted">
        <div className="mb-2 text-sm font-semibold text-ink">How it works</div>
        {(status?.notes ?? []).map((item) => (
          <div key={item} className="mb-2 rounded-md border border-line p-2">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
