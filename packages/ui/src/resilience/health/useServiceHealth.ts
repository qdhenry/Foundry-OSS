import { useSyncExternalStore } from "react";
import type { ConnectivityState } from "../types";
import type { ConvexConnectionMonitor } from "./ConvexConnectionMonitor";
import type { NetworkDetector } from "./NetworkDetector";

export function useConvexConnection(monitor: ConvexConnectionMonitor) {
  return useSyncExternalStore(
    (callback) => monitor.subscribe(callback),
    () => monitor.getState(),
    () => ({ state: "connected" as const, staleMs: 0 }),
  );
}

export function useNetworkState(detector: NetworkDetector) {
  return useSyncExternalStore<ConnectivityState>(
    (callback) => detector.subscribe(callback),
    () => detector.getState(),
    () => "online" as ConnectivityState,
  );
}
