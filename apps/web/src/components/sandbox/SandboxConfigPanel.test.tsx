import { describe, expect, it } from "vitest";
import { SandboxConfigPanel } from "./SandboxConfigPanel";

describe("SandboxConfigPanel", () => {
  it("re-exports SandboxConfigPanel from @foundry/ui", () => {
    expect(SandboxConfigPanel).toBeDefined();
    expect(typeof SandboxConfigPanel).toBe("function");
  });
});
