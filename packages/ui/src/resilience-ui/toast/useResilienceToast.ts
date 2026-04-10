"use client";

import { createElement, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useResilience } from "../../resilience/ResilienceProvider";
import type { ServiceName } from "../../resilience/types";
import { RecoveryToast } from "./RecoveryToast";
import { RetryProgressToast } from "./RetryProgressToast";
import { ServiceErrorToast } from "./ServiceErrorToast";

export function useResilienceToast() {
  const { retryEngine, registry, networkDetector, state } = useResilience();
  const activeToastIds = useRef(new Map<string, string | number>());
  const previousCircuitStates = useRef(new Map<ServiceName, string>());

  // Subscribe to retry engine events → toasts
  useEffect(() => {
    return retryEngine.subscribe((event, attempt) => {
      const toastKey = attempt.operationId;

      if (event === "retry-attempt" || event === "retry-start") {
        // Don't spam toasts if network is offline — show one generic toast
        if (!networkDetector.isOnline()) {
          if (!activeToastIds.current.has("network-offline")) {
            const id = toast.warning("You're offline — reconnecting...", {
              duration: Infinity,
              id: "network-offline",
            });
            activeToastIds.current.set("network-offline", id);
          }
          return;
        }

        const id = toast.custom(
          (toastId) =>
            createElement(RetryProgressToast, {
              attempt,
              onCancel: () => {
                toast.dismiss(toastId);
              },
            }),
          {
            duration: Infinity,
            id: toastKey,
          },
        );
        activeToastIds.current.set(toastKey, id);
      }

      if (event === "retry-success") {
        toast.dismiss(toastKey);
        activeToastIds.current.delete(toastKey);
      }

      if (event === "retry-failed") {
        toast.dismiss(toastKey);
        activeToastIds.current.delete(toastKey);
        toast.custom(
          () =>
            createElement(ServiceErrorToast, {
              service: attempt.service,
              message: attempt.error,
            }),
          { duration: 8000 },
        );
      }

      if (event === "retry-cancelled") {
        toast.dismiss(toastKey);
        activeToastIds.current.delete(toastKey);
      }
    });
  }, [retryEngine, networkDetector]);

  // Subscribe to circuit breaker state changes → recovery toasts
  useEffect(() => {
    return registry.subscribe((service, breakerState) => {
      const prevState = previousCircuitStates.current.get(service);
      previousCircuitStates.current.set(service, breakerState.state);

      // Circuit just closed (recovered)
      if (prevState === "open" && breakerState.state === "closed") {
        // Dismiss network offline toast if it exists
        toast.dismiss("network-offline");
        activeToastIds.current.delete("network-offline");

        toast.custom(() => createElement(RecoveryToast, { service }), { duration: 4000 });
      }
    });
  }, [registry]);

  // Clear network offline toast when back online
  useEffect(() => {
    if (state.networkOnline && activeToastIds.current.has("network-offline")) {
      toast.dismiss("network-offline");
      activeToastIds.current.delete("network-offline");
    }
  }, [state.networkOnline]);
}
