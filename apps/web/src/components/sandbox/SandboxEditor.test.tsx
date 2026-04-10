import { describe, expect, it } from "vitest";
import { SandboxEditor } from "./SandboxEditor";

describe("SandboxEditor", () => {
  it("re-exports SandboxEditor from @foundry/ui", () => {
    expect(SandboxEditor).toBeDefined();
    expect(typeof SandboxEditor).toBe("function");
  });
});
