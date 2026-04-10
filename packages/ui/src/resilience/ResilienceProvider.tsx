"use client";

import { useConvex } from "convex/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CircuitBreakerRegistry } from "./circuit-breaker/CircuitBreakerRegistry";
import { ALL_SERVICES } from "./constants";
import { ConvexConnectionMonitor } from "./health/ConvexConnectionMonitor";
import { NetworkDetector } from "./health/NetworkDetector";
import { RetryEngine } from "./retry/RetryEngine";
import type {
  CircuitBreakerState,
  ResilienceState,
  RetryAttempt,
  ServiceHealthState,
  ServiceName,
} from "./types";

interface ResilienceContextValue {
  registry: CircuitBreakerRegistry;
  retryEngine: RetryEngine;
  connectionMonitor: ConvexConnectionMonitor;
  networkDetector: NetworkDetector;
  state: ResilienceState;
}

const ResilienceContext = createContext<ResilienceContextValue | null>(null);

export function useResilience(): ResilienceContextValue {
  const ctx = useContext(ResilienceContext);
  if (!ctx) throw new Error("useResilience must be used within ResilienceProvider");
  return ctx;
}

export function useResilienceState(): ResilienceState {
  return useResilience().state;
}

function buildServiceHealth(
  service: ServiceName,
  breakerState: CircuitBreakerState,
  activeRetries: RetryAttempt[],
): ServiceHealthState {
  const retryCount = activeRetries.filter((r) => r.service === service).length;
  let status: ServiceHealthState["status"] = "healthy";

  if (breakerState.state === "open") {
    status = "outage";
  } else if (breakerState.state === "half-open" || retryCount > 0) {
    status = "degraded";
  }

  return {
    service,
    status,
    circuitState: breakerState.state,
    lastCheckedAt: breakerState.lastSuccessAt ?? breakerState.lastFailureAt ?? Date.now(),
    latencyMs: null,
    activeRetries: retryCount,
    message:
      breakerState.state === "open"
        ? `Service unavailable (${breakerState.failureCount} failures)`
        : undefined,
  };
}

export function ResilienceProvider({ children }: { children: ReactNode }) {
  // Singleton instances via ref (stable across renders)
  const registryRef = useRef<CircuitBreakerRegistry | null>(null);
  const retryEngineRef = useRef<RetryEngine | null>(null);
  const connectionMonitorRef = useRef<ConvexConnectionMonitor | null>(null);
  const networkDetectorRef = useRef<NetworkDetector | null>(null);

  if (!registryRef.current) {
    registryRef.current = new CircuitBreakerRegistry();
  }
  if (!retryEngineRef.current) {
    retryEngineRef.current = new RetryEngine();
    retryEngineRef.current.setCircuitBreakerRegistry(registryRef.current);
  }
  if (!connectionMonitorRef.current) {
    connectionMonitorRef.current = new ConvexConnectionMonitor();
  }
  if (!networkDetectorRef.current) {
    networkDetectorRef.current = new NetworkDetector();
  }

  const registry = registryRef.current;
  const retryEngine = retryEngineRef.current;
  const connectionMonitor = connectionMonitorRef.current;
  const networkDetector = networkDetectorRef.current;

  // Use Convex client's built-in WebSocket connection state
  const client = useConvex();

  // Start monitors on mount
  useEffect(() => {
    connectionMonitor.start(client);
    networkDetector.start();
    return () => {
      connectionMonitor.stop();
      networkDetector.stop();
      registry.destroy();
      retryEngine.cancelAll();
    };
  }, [client, connectionMonitor, networkDetector, registry, retryEngine]);

  // Reactive state: circuit breakers + retries + connection + network
  const [circuitStates, setCircuitStates] = useState<Map<ServiceName, CircuitBreakerState>>(() =>
    registry.getAll(),
  );
  const [activeRetries, setActiveRetries] = useState<RetryAttempt[]>([]);
  const [convexConnected, setConvexConnected] = useState(true);
  const [networkOnline, setNetworkOnline] = useState(true);

  // Subscribe to circuit breaker changes
  useEffect(() => {
    return registry.subscribe((service, state) => {
      setCircuitStates((prev) => {
        const next = new Map(prev);
        next.set(service, state);
        return next;
      });
    });
  }, [registry]);

  // Subscribe to retry engine changes
  useEffect(() => {
    return retryEngine.subscribe(() => {
      setActiveRetries(retryEngine.getActiveRetries());
    });
  }, [retryEngine]);

  // Subscribe to connection monitor
  useEffect(() => {
    return connectionMonitor.subscribe((connState) => {
      setConvexConnected(connState === "connected");
    });
  }, [connectionMonitor]);

  // Subscribe to network detector
  useEffect(() => {
    return networkDetector.subscribe((netState) => {
      setNetworkOnline(netState === "online" || netState === "service_outage");
    });
  }, [networkDetector]);

  // Build resilience state
  const readOnlyMode = !convexConnected;

  const state = useMemo<ResilienceState>(() => {
    const services = {} as Record<ServiceName, ServiceHealthState>;
    for (const service of ALL_SERVICES) {
      const breakerState = circuitStates.get(service) ?? {
        service,
        state: "closed" as const,
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        nextRetryAt: null,
        consecutiveSuccesses: 0,
      };
      services[service] = buildServiceHealth(service, breakerState, activeRetries);
    }
    return {
      services,
      convexConnected,
      networkOnline,
      activeRetries,
      readOnlyMode,
    };
  }, [circuitStates, activeRetries, convexConnected, networkOnline, readOnlyMode]);

  const contextValue = useMemo<ResilienceContextValue>(
    () => ({
      registry,
      retryEngine,
      connectionMonitor,
      networkDetector,
      state,
    }),
    [registry, retryEngine, connectionMonitor, networkDetector, state],
  );

  return <ResilienceContext.Provider value={contextValue}>{children}</ResilienceContext.Provider>;
}
