import { describe, expect, it, vi } from "vitest";
import { NetworkDetector } from "./NetworkDetector";

describe("NetworkDetector", () => {
  it("starts with online state", () => {
    const detector = new NetworkDetector();
    detector.start();
    expect(detector.getState()).toBe("online");
    expect(detector.isOnline()).toBe(true);
    detector.stop();
  });

  it("reports service_outage when online", () => {
    const detector = new NetworkDetector();
    detector.start();
    detector.reportServiceOutage();
    expect(detector.getState()).toBe("service_outage");
    expect(detector.isOnline()).toBe(true); // still "online" for network
    detector.stop();
  });

  it("clears service outage", () => {
    const detector = new NetworkDetector();
    detector.start();
    detector.reportServiceOutage();
    detector.clearServiceOutage();
    expect(detector.getState()).toBe("online");
    detector.stop();
  });

  it("does not change to service_outage when offline", () => {
    const detector = new NetworkDetector();
    detector.start();
    detector.simulateOffline();
    detector.reportServiceOutage();
    expect(detector.getState()).toBe("network_offline");
    detector.stop();
  });

  it("simulateOffline sets network_offline", () => {
    const detector = new NetworkDetector();
    detector.start();
    detector.simulateOffline();
    expect(detector.getState()).toBe("network_offline");
    expect(detector.isOnline()).toBe(false);
    detector.stop();
  });

  it("subscribe/unsubscribe works", () => {
    const detector = new NetworkDetector();
    detector.start();
    const listener = vi.fn();
    const unsub = detector.subscribe(listener);
    detector.simulateOffline();
    expect(listener).toHaveBeenCalledWith("network_offline");
    unsub();
    detector.simulateOnline();
    expect(listener).toHaveBeenCalledTimes(1);
    detector.stop();
  });
});
