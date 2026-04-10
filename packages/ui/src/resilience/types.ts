export type ServiceName =
  | "convex"
  | "clerk"
  | "anthropic"
  | "github"
  | "jira"
  | "confluence"
  | "stripe"
  | "sandbox"
  | "twelveLabs";

export type ServiceStatus = "healthy" | "degraded" | "outage" | "unknown";
export type CircuitState = "closed" | "open" | "half-open";
export type ConnectivityState = "online" | "service_outage" | "network_offline" | "unknown";

export interface CircuitBreakerConfig {
  service: ServiceName;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  monitorWindowMs: number;
}

export interface CircuitBreakerState {
  service: ServiceName;
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  nextRetryAt: number | null;
  consecutiveSuccesses: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface RetryAttempt {
  service: ServiceName;
  operationId: string;
  operationLabel: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number;
  error: string;
  status: "retrying" | "succeeded" | "failed" | "cancelled";
}

export interface RetryHandle {
  operationId: string;
  cancel: () => void;
  promise: Promise<unknown>;
}

export interface ServiceHealthState {
  service: ServiceName;
  status: ServiceStatus;
  circuitState: CircuitState;
  lastCheckedAt: number;
  latencyMs: number | null;
  activeRetries: number;
  message?: string;
}

export interface ResilienceState {
  services: Record<ServiceName, ServiceHealthState>;
  convexConnected: boolean;
  networkOnline: boolean;
  activeRetries: RetryAttempt[];
  readOnlyMode: boolean;
}

export interface ServiceConfig {
  circuit: CircuitBreakerConfig;
  retry: RetryConfig;
  displayName: string;
  critical: boolean;
}
