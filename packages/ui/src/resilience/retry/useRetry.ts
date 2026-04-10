import { useCallback, useSyncExternalStore } from "react";
import type { RetryAttempt, RetryConfig, ServiceName } from "../types";
import type { RetryEngine } from "./RetryEngine";

export function useRetry(engine: RetryEngine) {
  const activeRetries = useSyncExternalStore<RetryAttempt[]>(
    (callback) => engine.subscribeToActiveRetries(callback),
    () => engine.getActiveRetries(),
    () => engine.getActiveRetries(),
  );

  const execute = useCallback(
    <T>(
      service: ServiceName,
      label: string,
      fn: (signal: AbortSignal) => Promise<T>,
      config: RetryConfig,
    ) => engine.execute(service, label, fn, config),
    [engine],
  );

  const cancelAll = useCallback(() => engine.cancelAll(), [engine]);

  return { activeRetries, execute, cancelAll };
}
