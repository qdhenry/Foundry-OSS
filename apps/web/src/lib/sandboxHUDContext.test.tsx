import { describe, expect, it } from "vitest";
import { SandboxHUDProvider, useSandboxHUD } from "./sandboxHUDContext";

describe("sandboxHUDContext", () => {
  it("re-exports SandboxHUDProvider from @foundry/ui", () => {
    expect(SandboxHUDProvider).toBeDefined();
    expect(typeof SandboxHUDProvider).toBe("function");
  });

  it("re-exports useSandboxHUD from @foundry/ui", () => {
    expect(useSandboxHUD).toBeDefined();
    expect(typeof useSandboxHUD).toBe("function");
  });
});
