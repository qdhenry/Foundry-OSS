import { describe, expect, it } from "vitest";
import { SandboxTerminal } from "./SandboxTerminal";

describe("SandboxTerminal", () => {
  it("re-exports SandboxTerminal from @foundry/ui", () => {
    expect(SandboxTerminal).toBeDefined();
    expect(typeof SandboxTerminal).toBe("function");
  });
});
