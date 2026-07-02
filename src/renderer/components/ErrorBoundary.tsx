import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort catch for renderer crashes: without it a single thrown render error unmounts the
 * whole app into a blank window with no way back short of killing the process.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-shell p-8 text-ink">
        <div className="text-lg font-semibold">AppDeck hit an unexpected error</div>
        <div className="max-w-lg break-words text-center text-sm text-muted">
          {this.state.error.message}
        </div>
        <button className="app-button primary" onClick={() => window.location.reload()}>
          Reload AppDeck
        </button>
      </div>
    );
  }
}
