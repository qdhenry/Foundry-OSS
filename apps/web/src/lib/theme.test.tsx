import { describe, expect, it } from "vitest";
import * as themeExports from "./theme";

describe("theme", () => {
  it("re-exports from @foundry/ui/theme", () => {
    expect(themeExports).toBeDefined();
    expect(Object.keys(themeExports).length).toBeGreaterThan(0);
  });
});
