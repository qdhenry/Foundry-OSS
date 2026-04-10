import { describe, expect, it } from "vitest";
import * as sandboxBackend from "./sandboxBackendContext";

describe("sandboxBackendContext", () => {
  it("re-exports from @foundry/ui/backend", () => {
    expect(sandboxBackend).toBeDefined();
    expect(Object.keys(sandboxBackend).length).toBeGreaterThan(0);
  });
});
