import type { CircuitBreakerConfig, CircuitBreakerState, CircuitState } from "../types";

type StateChangeListener = (state: CircuitBreakerState) => void;

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private failureTimestamps: number[] = [];
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private nextRetryAt: number | null = null;
  private consecutiveSuccesses = 0;
  private simulatedOpen = false;
  private listeners: Set<StateChangeListener> = new Set();

  constructor(private config: CircuitBreakerConfig) {}

  /** Returns whether the circuit allows a request. */
  isAvailable(): boolean {
    if (this.simulatedOpen) return false;
    if (this.state === "closed") return true;
    if (this.state === "open") {
      // Check if cooldown has elapsed
      if (this.nextRetryAt && Date.now() >= this.nextRetryAt) {
        this.transitionTo("half-open");
        return true;
      }
      return false;
    }
    // half-open: allow limited attempts
    return this.consecutiveSuccesses < this.config.halfOpenMaxAttempts;
  }

  recordSuccess(): void {
    if (this.state === "half-open") {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.config.halfOpenMaxAttempts) {
        this.transitionTo("closed");
      }
    } else if (this.state === "closed") {
      // Reset failure tracking on success
      this.failureCount = 0;
      this.failureTimestamps = [];
    }
    this.lastSuccessAt = Date.now();
    this.notifyListeners();
  }

  recordFailure(): void {
    const now = Date.now();

    if (this.state === "half-open") {
      // Any failure in half-open sends back to open
      this.transitionTo("open");
      return;
    }

    // Sliding window: remove old failures
    const windowStart = now - this.config.monitorWindowMs;
    this.failureTimestamps = this.failureTimestamps.filter((t) => t > windowStart);
    this.failureTimestamps.push(now);
    this.failureCount = this.failureTimestamps.length;
    this.lastFailureAt = now;

    if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo("open");
    } else {
      this.notifyListeners();
    }
  }

  getState(): CircuitBreakerState {
    return {
      service: this.config.service,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      nextRetryAt: this.nextRetryAt,
      consecutiveSuccesses: this.consecutiveSuccesses,
    };
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Restore from persisted state (sessionStorage). */
  restore(persisted: CircuitBreakerState): void {
    this.state = persisted.state;
    this.failureCount = persisted.failureCount;
    this.lastFailureAt = persisted.lastFailureAt;
    this.lastSuccessAt = persisted.lastSuccessAt;
    this.nextRetryAt = persisted.nextRetryAt;
    this.consecutiveSuccesses = persisted.consecutiveSuccesses;
    // Revalidate: if open and cooldown has elapsed, move to half-open
    if (this.state === "open" && this.nextRetryAt && Date.now() >= this.nextRetryAt) {
      this.transitionTo("half-open");
    }
  }

  reset(): void {
    this.simulatedOpen = false;
    this.transitionTo("closed");
  }

  forceOpen(): void {
    this.simulatedOpen = true;
    this.lastFailureAt = Date.now();
    this.failureCount = this.config.failureThreshold;
    this.transitionTo("open");
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    if (newState === "open") {
      this.nextRetryAt = Date.now() + this.config.resetTimeoutMs;
      this.consecutiveSuccesses = 0;
    } else if (newState === "closed") {
      this.failureCount = 0;
      this.failureTimestamps = [];
      this.nextRetryAt = null;
      this.consecutiveSuccesses = 0;
    } else if (newState === "half-open") {
      this.consecutiveSuccesses = 0;
    }
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }
}
