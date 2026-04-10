import type { ConvexReactClient } from "convex/react";

type ConnectionState = "connected" | "disconnected" | "reconnecting";
type ConnectionListener = (state: ConnectionState, staleMs: number) => void;

export class ConvexConnectionMonitor {
  private state: ConnectionState = "connected";
  private staleMs = 0;
  private disconnectedSince: number | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<ConnectionListener>();
  private simulating = false;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  start(client: ConvexReactClient): void {
    // Subscribe to Convex's authoritative WebSocket connection state
    this.unsubscribe = client.subscribeToConnectionState((cs) => {
      if (this.simulating) return;

      if (cs.isWebSocketConnected) {
        // Clear pending disconnect timer on reconnect (suppresses transient blips)
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
        this.disconnectedSince = null;
        this.staleMs = 0;
        this.stopTick();

        if (this.state !== "connected") {
          this.state = "connected";
          this.notify();
        }
      } else {
        // WebSocket is not connected — debounce to avoid flashing banners on navigation
        if (this.state === "connected" && !this.disconnectTimer) {
          this.disconnectTimer = setTimeout(() => {
            this.disconnectTimer = null;
            // Only transition if still not reconnected
            if (this.state === "connected") {
              this.disconnectedSince = Date.now();
              this.state = cs.hasEverConnected ? "reconnecting" : "disconnected";
              this.startTick();
              this.notify();
            }
          }, 2000);
        }
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.stopTick();
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  getState(): { state: ConnectionState; staleMs: number } {
    return { state: this.state, staleMs: this.staleMs };
  }

  isConnected(): boolean {
    return this.state === "connected";
  }

  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  simulateDisconnect(): void {
    this.simulating = true;
    this.disconnectedSince = Date.now();
    this.staleMs = 0;
    this.state = "disconnected";
    this.startTick();
    this.notify();
  }

  simulateReconnect(): void {
    this.simulating = false;
    this.disconnectedSince = null;
    this.staleMs = 0;
    this.state = "connected";
    this.stopTick();
    this.notify();
  }

  // 1-second tick runs only while disconnected to update the seconds counter
  private startTick(): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      if (this.disconnectedSince) {
        this.staleMs = Date.now() - this.disconnectedSince;

        // Transition from reconnecting -> disconnected after 30s
        if (this.state === "reconnecting" && this.staleMs > 30_000) {
          this.state = "disconnected";
        }

        this.notify();
      }
    }, 1_000);
  }

  private stopTick(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state, this.staleMs);
    }
  }
}
