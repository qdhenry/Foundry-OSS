import type { CircuitBreakerRegistry } from "../circuit-breaker/CircuitBreakerRegistry";
import type { RetryAttempt, RetryConfig, RetryHandle, ServiceName } from "../types";

type RetryEventType =
  | "retry-start"
  | "retry-attempt"
  | "retry-success"
  | "retry-failed"
  | "retry-cancelled";

type RetryListener = (event: RetryEventType, attempt: RetryAttempt) => void;

let operationCounter = 0;

export class RetryEngine {
  private activeRetries = new Map<
    string,
    { attempt: RetryAttempt; abortController: AbortController }
  >();
  private listeners = new Set<RetryListener>();
  private circuitBreakerRegistry: CircuitBreakerRegistry | null = null;

  setCircuitBreakerRegistry(registry: CircuitBreakerRegistry): void {
    this.circuitBreakerRegistry = registry;
  }

  async execute<T>(
    service: ServiceName,
    label: string,
    fn: (signal: AbortSignal) => Promise<T>,
    config: RetryConfig,
  ): Promise<T> {
    const operationId = `${service}-${++operationCounter}`;
    const abortController = new AbortController();

    const attempt: RetryAttempt = {
      service,
      operationId,
      operationLabel: label,
      attempt: 0,
      maxAttempts: config.maxRetries + 1,
      nextRetryAt: 0,
      error: "",
      status: "retrying",
    };

    this.activeRetries.set(operationId, { attempt, abortController });
    this.emit("retry-start", attempt);

    try {
      for (let i = 0; i <= config.maxRetries; i++) {
        if (abortController.signal.aborted) {
          attempt.status = "cancelled";
          this.emit("retry-cancelled", attempt);
          throw new DOMException("Retry cancelled", "AbortError");
        }

        // Check circuit breaker
        if (this.circuitBreakerRegistry) {
          const breaker = this.circuitBreakerRegistry.get(service);
          if (!breaker.isAvailable()) {
            attempt.status = "failed";
            attempt.error = `${service} circuit breaker is open`;
            this.emit("retry-failed", attempt);
            throw new Error(`Service ${service} is currently unavailable (circuit breaker open)`);
          }
        }

        attempt.attempt = i + 1;

        try {
          const result = await fn(abortController.signal);

          // Record success
          if (this.circuitBreakerRegistry) {
            this.circuitBreakerRegistry.get(service).recordSuccess();
          }

          attempt.status = "succeeded";
          this.emit("retry-success", attempt);
          return result;
        } catch (error) {
          if (abortController.signal.aborted) {
            attempt.status = "cancelled";
            this.emit("retry-cancelled", attempt);
            throw error;
          }

          const errorMessage = error instanceof Error ? error.message : String(error);
          attempt.error = errorMessage;

          // Record failure with circuit breaker
          if (this.circuitBreakerRegistry) {
            this.circuitBreakerRegistry.get(service).recordFailure();
          }

          if (i < config.maxRetries) {
            // Calculate delay
            const delay = this.calculateDelay(i, config);
            attempt.nextRetryAt = Date.now() + delay;
            this.emit("retry-attempt", attempt);

            // Wait with abort support
            await this.delay(delay, abortController.signal);
          } else {
            // Final attempt failed
            attempt.status = "failed";
            this.emit("retry-failed", attempt);
            throw error;
          }
        }
      }
    } finally {
      this.activeRetries.delete(operationId);
    }

    // Unreachable
    throw new Error("Retry exhausted");
  }

  createHandle(
    service: ServiceName,
    label: string,
    fn: (signal: AbortSignal) => Promise<unknown>,
    config: RetryConfig,
  ): RetryHandle {
    const abortController = new AbortController();
    const operationId = `${service}-${++operationCounter}`;

    const promise = this.execute(
      service,
      label,
      (signal) => {
        // Chain abort signals
        const linkedAbort = new AbortController();
        signal.addEventListener("abort", () => linkedAbort.abort());
        abortController.signal.addEventListener("abort", () => linkedAbort.abort());
        return fn(linkedAbort.signal);
      },
      config,
    );

    return {
      operationId,
      cancel: () => abortController.abort(),
      promise,
    };
  }

  getActiveRetries(): RetryAttempt[] {
    return Array.from(this.activeRetries.values()).map((r) => ({
      ...r.attempt,
    }));
  }

  cancelAll(): void {
    for (const { abortController } of this.activeRetries.values()) {
      abortController.abort();
    }
  }

  subscribe(listener: RetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Subscribe to just active retries list changes (for UI)
  subscribeToActiveRetries(callback: () => void): () => void {
    const wrappedListener: RetryListener = () => callback();
    this.listeners.add(wrappedListener);
    return () => this.listeners.delete(wrappedListener);
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelayMs * config.backoffMultiplier ** attempt;
    let delay = Math.min(exponentialDelay, config.maxDelayMs);
    if (config.jitter) {
      delay += Math.random() * config.baseDelayMs;
    }
    return Math.round(delay);
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Retry cancelled", "AbortError"));
        },
        { once: true },
      );
    });
  }

  private emit(event: RetryEventType, attempt: RetryAttempt): void {
    const snapshot = { ...attempt };
    for (const listener of this.listeners) {
      listener(event, snapshot);
    }
  }
}
