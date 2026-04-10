import type { ServiceConfig, ServiceName } from "./types";

export const SERVICE_CONFIGS: Record<ServiceName, ServiceConfig> = {
  convex: {
    circuit: {
      service: "convex",
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 60_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "Database",
    critical: true,
  },
  clerk: {
    circuit: {
      service: "clerk",
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 120_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "Authentication",
    critical: true,
  },
  anthropic: {
    circuit: {
      service: "anthropic",
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 120_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 2_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "AI (Claude)",
    critical: false,
  },
  github: {
    circuit: {
      service: "github",
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 120_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "GitHub",
    critical: false,
  },
  jira: {
    circuit: {
      service: "jira",
      failureThreshold: 5,
      resetTimeoutMs: 90_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 120_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 2_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "Jira",
    critical: false,
  },
  confluence: {
    circuit: {
      service: "confluence",
      failureThreshold: 5,
      resetTimeoutMs: 90_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 120_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 2_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "Confluence",
    critical: false,
  },
  stripe: {
    circuit: {
      service: "stripe",
      failureThreshold: 5,
      resetTimeoutMs: 120_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 120_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "Billing",
    critical: false,
  },
  sandbox: {
    circuit: {
      service: "sandbox",
      failureThreshold: 3,
      resetTimeoutMs: 60_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 60_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "Sandbox",
    critical: false,
  },
  twelveLabs: {
    circuit: {
      service: "twelveLabs",
      failureThreshold: 5,
      resetTimeoutMs: 120_000,
      halfOpenMaxAttempts: 1,
      monitorWindowMs: 120_000,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 2_000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
      jitter: true,
    },
    displayName: "Video Analysis",
    critical: false,
  },
};

export const ALL_SERVICES: ServiceName[] = [
  "convex",
  "clerk",
  "anthropic",
  "github",
  "jira",
  "confluence",
  "stripe",
  "sandbox",
  "twelveLabs",
];

export const CRITICAL_SERVICES: ServiceName[] = ALL_SERVICES.filter(
  (s) => SERVICE_CONFIGS[s].critical,
);

export const DEFAULT_TOAST_DURATION = 4_000;
export const MAX_VISIBLE_TOASTS = 3;
