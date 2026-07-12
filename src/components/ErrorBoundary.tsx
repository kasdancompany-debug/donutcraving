import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Auto-reload after this many ms when an error is caught (kiosk). */
  reloadAfterMs?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort catch for render/runtime errors so the booth can recover
 * instead of sitting on a blank white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  private reloadTimer: number | null = null;

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Donut mirror crashed:', error, info.componentStack);
  }

  componentDidUpdate(_: ErrorBoundaryProps, prevState: ErrorBoundaryState): void {
    if (this.state.hasError && !prevState.hasError) {
      const delay = this.props.reloadAfterMs ?? 2500;
      this.reloadTimer = window.setTimeout(() => {
        window.location.reload();
      }, delay);
    }
  }

  componentWillUnmount(): void {
    if (this.reloadTimer !== null) {
      window.clearTimeout(this.reloadTimer);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="overlay overlay-error">
          <p className="overlay-text">Something went wrong</p>
          <p className="overlay-subtext">Restarting the mirror…</p>
        </div>
      );
    }

    return this.props.children;
  }
}
