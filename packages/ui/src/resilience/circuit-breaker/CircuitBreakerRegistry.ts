import { ALL_SERVICES, SERVICE_CONFIGS } from "../constants";
import type { CircuitBreakerState, ServiceName } from "../types";
import { CircuitBreaker } from "./CircuitBreaker";

const STORAGE_KEY = "foundry:circuit-breakers";
const CHANNEL_NAME = "foundry:circuit-breakers";

type RegistryListener = (service: ServiceName, state: CircuitBreakerState) => void;

export class CircuitBreakerRegistry {
  private breakers = new Map<ServiceName, CircuitBreaker>();
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<RegistryListener>();

  constructor() {
    // Initialize all circuit breakers
    for (const service of ALL_SERVICES) {
      const config = SERVICE_CONFIGS[service];
      const breaker = new CircuitBreaker(config.circuit);

      // Subscribe to state changes for persistence + cross-tab sync
      breaker.subscribe((state) => {
        this.persistState();
        this.broadcastState(state);
        this.notifyListeners(service, state);
      });

      this.breakers.set(service, breaker);
    }

    // Restore from sessionStorage
    this.restoreState();

    // Listen for cross-tab updates
    this.initBroadcastChannel();
  }

  get(service: ServiceName): CircuitBreaker {
    const breaker = this.breakers.get(service);
    if (!breaker) throw new Error(`No circuit breaker for service: ${service}`);
    return breaker;
  }

  getAll(): Map<ServiceName, CircuitBreakerState> {
    const result = new Map<ServiceName, CircuitBreakerState>();
    for (const [name, breaker] of this.breakers) {
      result.set(name, breaker.getState());
    }
    return result;
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  simulateOutage(service: ServiceName): void {
    this.get(service).forceOpen();
  }

  simulateRecovery(service: ServiceName): void {
    this.get(service).reset();
  }

  destroy(): void {
    this.channel?.close();
    this.listeners.clear();
  }

  private persistState(): void {
    try {
      const states: Record<string, CircuitBreakerState> = {};
      for (const [name, breaker] of this.breakers) {
        states[name] = breaker.getState();
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch {
      // sessionStorage unavailable (Tauri fallback: silent)
    }
  }

  private restoreState(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const states = JSON.parse(raw) as Record<string, CircuitBreakerState>;
      for (const [name, state] of Object.entries(states)) {
        const breaker = this.breakers.get(name as ServiceName);
        if (breaker) breaker.restore(state);
      }
    } catch {
      // Corrupted or unavailable
    }
  }

  private initBroadcastChannel(): void {
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent) => {
        const state = event.data as CircuitBreakerState;
        const breaker = this.breakers.get(state.service);
        if (breaker) {
          breaker.restore(state);
          this.notifyListeners(state.service, state);
        }
      };
    } catch {
      // BroadcastChannel unavailable
    }
  }

  private broadcastState(state: CircuitBreakerState): void {
    try {
      this.channel?.postMessage(state);
    } catch {
      // Channel closed or unavailable
    }
  }

  private notifyListeners(service: ServiceName, state: CircuitBreakerState): void {
    for (const listener of this.listeners) {
      listener(service, state);
    }
  }
}
