import type { ConnectivityState } from "../types";

type NetworkListener = (state: ConnectivityState) => void;

export class NetworkDetector {
  private state: ConnectivityState = "online";
  private listeners = new Set<NetworkListener>();
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  start(): void {
    if (typeof window === "undefined") return;

    this.state = navigator.onLine ? "online" : "network_offline";

    this.onlineHandler = () => {
      this.state = "online";
      this.notify();
    };

    this.offlineHandler = () => {
      this.state = "network_offline";
      this.notify();
    };

    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);
  }

  stop(): void {
    if (typeof window === "undefined") return;
    if (this.onlineHandler) window.removeEventListener("online", this.onlineHandler);
    if (this.offlineHandler) window.removeEventListener("offline", this.offlineHandler);
  }

  getState(): ConnectivityState {
    return this.state;
  }

  isOnline(): boolean {
    return this.state === "online" || this.state === "service_outage";
  }

  // Called when a specific service fails but network seems up
  reportServiceOutage(): void {
    if (this.state === "online") {
      this.state = "service_outage";
      this.notify();
    }
  }

  // Called when all services recover
  clearServiceOutage(): void {
    if (this.state === "service_outage") {
      this.state = "online";
      this.notify();
    }
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  simulateOffline(): void {
    this.state = "network_offline";
    this.notify();
  }

  simulateOnline(): void {
    this.state = navigator.onLine ? "online" : "network_offline";
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
