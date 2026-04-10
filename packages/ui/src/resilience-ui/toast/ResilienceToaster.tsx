"use client";

import { Toaster } from "sonner";

export function ResilienceToaster() {
  return (
    <Toaster
      position="bottom-right"
      visibleToasts={3}
      toastOptions={{
        className:
          "!bg-surface-raised !text-text-primary !border-border-default !shadow-lg !rounded-lg",
        descriptionClassName: "!text-text-secondary",
      }}
      gap={8}
    />
  );
}
