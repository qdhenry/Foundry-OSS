"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { SERVICE_CONFIGS } from "../../resilience/constants";
import type { ServiceName } from "../../resilience/types";
import { ErrorFallback } from "./ErrorFallback";

interface Props {
  service?: ServiceName;
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ServiceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ServiceErrorBoundary${this.props.service ? `:${this.props.service}` : ""}]`,
      error,
      errorInfo,
    );
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const serviceName = this.props.service
        ? SERVICE_CONFIGS[this.props.service]?.displayName
        : undefined;
      const isCritical = this.props.service
        ? (SERVICE_CONFIGS[this.props.service]?.critical ?? false)
        : true;

      return (
        <ErrorFallback
          error={this.state.error}
          serviceName={serviceName}
          isCritical={isCritical}
          onRetry={this.reset}
        />
      );
    }

    return this.props.children;
  }
}
