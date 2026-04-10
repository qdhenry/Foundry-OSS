"use client";

import { useCallback } from "react";
import { SERVICE_CONFIGS } from "./constants";
import { useResilience } from "./ResilienceProvider";
import type { ServiceName } from "./types";

export class ServiceUnavailableError extends Error {
  public readonly services: ServiceName[];

  constructor(services: ServiceName[]) {
    const names = services.map((s) => SERVICE_CONFIGS[s].displayName);
    const msg =
      names.length === 1
        ? `${names[0]} is currently unavailable`
        : `${names.join(", ")} are currently unavailable`;
    super(msg);
    this.name = "ServiceUnavailableError";
    this.services = services;
  }
}

/**
 * Hook that gates operations on circuit breaker availability.
 *
 * Usage:
 *   const { assertAvailable, isAvailable } = useServiceGate();
 *
 *   // Throws ServiceUnavailableError if AI is down
 *   assertAvailable(["anthropic"]);
 *
 *   // Boolean check
 *   if (!isAvailable(["anthropic", "convex"])) { ... }
 */
export function useServiceGate() {
  const { registry } = useResilience();

  const getUnavailable = useCallback(
    (services: ServiceName[]): ServiceName[] =>
      services.filter((s) => !registry.get(s).isAvailable()),
    [registry],
  );

  const isAvailable = useCallback(
    (services: ServiceName[]): boolean => getUnavailable(services).length === 0,
    [getUnavailable],
  );

  const assertAvailable = useCallback(
    (services: ServiceName[]): void => {
      const down = getUnavailable(services);
      if (down.length > 0) throw new ServiceUnavailableError(down);
    },
    [getUnavailable],
  );

  return { assertAvailable, isAvailable, getUnavailable };
}
