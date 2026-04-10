import { describe, expect, it } from "vitest";
import { SandboxSettingsPage } from "./SandboxSettingsPage";

describe("SandboxSettingsPage", () => {
  it("re-exports SandboxSettingsPage from @foundry/ui", () => {
    expect(SandboxSettingsPage).toBeDefined();
    expect(typeof SandboxSettingsPage).toBe("function");
  });
});
