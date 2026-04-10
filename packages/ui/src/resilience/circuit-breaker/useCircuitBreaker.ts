import { useCallback, useSyncExternalStore } from "react";
import type { CircuitBreakerState, ServiceName } from "../types";
import type { CircuitBreakerRegistry } from "./CircuitBreakerRegistry";

export function useCircuitBreaker(registry: CircuitBreakerRegistry, service: ServiceName) {
  const breaker = registry.get(service);

  const state = useSyncExternalStore<CircuitBreakerState>(
    (callback) => breaker.subscribe(callback),
    () => breaker.getState(),
    () => breaker.getState(),
  );

  const isAvailable = useSyncExternalStore(
    (callback) => breaker.subscribe(callback),
    () => breaker.isAvailable(),
    () => breaker.isAvailable(),
  );

  const recordSuccess = useCallback(() => breaker.recordSuccess(), [breaker]);
  const recordFailure = useCallback(() => breaker.recordFailure(), [breaker]);
  const reset = useCallback(() => breaker.reset(), [breaker]);

  return { state, isAvailable, recordSuccess, recordFailure, reset };
}
