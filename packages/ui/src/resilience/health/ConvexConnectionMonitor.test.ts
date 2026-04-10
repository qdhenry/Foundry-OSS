import { describe, expect, it, vi } from "vitest";
import { ConvexConnectionMonitor } from "./ConvexConnectionMonitor";

describe("ConvexConnectionMonitor", () => {
  it("starts in connected state", () => {
    const monitor = new ConvexConnectionMonitor();
    expect(monitor.getState()).toEqual({ state: "connected", staleMs: 0 });
    expect(monitor.isConnected()).toBe(true);
  });

  it("simulateDisconnect sets disconnected state", () => {
    const monitor = new ConvexConnectionMonitor();
    monitor.simulateDisconnect();
    expect(monitor.getState().state).toBe("disconnected");
    expect(monitor.isConnected()).toBe(false);
    monitor.stop();
  });

  it("simulateReconnect restores connected state", () => {
    const monitor = new ConvexConnectionMonitor();
    monitor.simulateDisconnect();
    monitor.simulateReconnect();
    expect(monitor.getState().state).toBe("connected");
    expect(monitor.isConnected()).toBe(true);
    monitor.stop();
  });

  it("notifies subscribers on state changes", () => {
    const monitor = new ConvexConnectionMonitor();
    const listener = vi.fn();
    monitor.subscribe(listener);
    monitor.simulateDisconnect();
    expect(listener).toHaveBeenCalledWith("disconnected", 0);
    monitor.stop();
  });

  it("unsubscribe stops notifications", () => {
    const monitor = new ConvexConnectionMonitor();
    const listener = vi.fn();
    const unsub = monitor.subscribe(listener);
    unsub();
    monitor.simulateDisconnect();
    expect(listener).not.toHaveBeenCalled();
    monitor.stop();
  });
});
