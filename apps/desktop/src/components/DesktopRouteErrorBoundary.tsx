import { Component, type ErrorInfo, type ReactNode } from "react";
import { logDesktop, normalizeErrorForLog, resolveErrorMessage } from "../lib/desktop-logging";
import { navigateDesktop } from "../shims/navigation";

interface DesktopRouteErrorBoundaryProps {
  routeId: string;
  pathname: string;
  children: ReactNode;
}

interface DesktopRouteErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class DesktopRouteErrorBoundary extends Component<
  DesktopRouteErrorBoundaryProps,
  DesktopRouteErrorBoundaryState
> {
  state: DesktopRouteErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: unknown): DesktopRouteErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: resolveErrorMessage(
        error,
        "An unexpected rendering error occurred."
      ),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    logDesktop("error", "route-boundary", "Route render crashed", {
      routeId: this.props.routeId,
      pathname: this.props.pathname,
      error: normalizeErrorForLog(error),
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(prevProps: DesktopRouteErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      (prevProps.routeId !== this.props.routeId ||
        prevProps.pathname !== this.props.pathname)
    ) {
      this.setState({ hasError: false, errorMessage: "" });
    }
  }

  private handleGoToPrograms = () => {
    navigateDesktop("/programs", { replace: true });
  };

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="card rounded-xl border-status-error-border bg-status-error-bg p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-status-error-fg">
          Route Error
        </p>
        <h2 className="mt-2 text-lg font-semibold text-text-heading">
          This page hit an unexpected error
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Route: <span className="font-mono">{this.props.pathname}</span>
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {this.state.errorMessage}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button className="btn-primary btn-sm" onClick={this.handleGoToPrograms}>
            Go to Programs
          </button>
          <button
            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
            onClick={this.handleReload}
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
