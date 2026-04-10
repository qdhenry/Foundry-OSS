import { describe, expect, it } from "vitest";
import { CommandPalette } from "./CommandPalette";

describe("CommandPalette", () => {
  it("re-exports CommandPalette from @foundry/ui", () => {
    expect(CommandPalette).toBeDefined();
    expect(typeof CommandPalette).toBe("function");
  });
});
