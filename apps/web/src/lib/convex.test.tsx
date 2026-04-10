import { describe, expect, it } from "vitest";
import { ConvexClientProvider } from "./convex";

describe("convex", () => {
  it("exports ConvexClientProvider", () => {
    expect(ConvexClientProvider).toBeDefined();
    expect(typeof ConvexClientProvider).toBe("function");
  });
});
