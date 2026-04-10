import { describe, expect, it } from "vitest";
import { SandboxHUD } from "./SandboxHUD";

describe("SandboxHUD", () => {
  it("re-exports SandboxHUD from @foundry/ui", () => {
    expect(SandboxHUD).toBeDefined();
    expect(typeof SandboxHUD).toBe("function");
  });
});
