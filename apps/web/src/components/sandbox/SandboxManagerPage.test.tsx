import { describe, expect, it } from "vitest";
import { SandboxManagerPage } from "./SandboxManagerPage";

describe("SandboxManagerPage", () => {
  it("re-exports SandboxManagerPage from @foundry/ui", () => {
    expect(SandboxManagerPage).toBeDefined();
    expect(typeof SandboxManagerPage).toBe("function");
  });
});
