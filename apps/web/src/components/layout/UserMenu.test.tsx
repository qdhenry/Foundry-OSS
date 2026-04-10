import { describe, expect, it } from "vitest";
import { UserMenu } from "./UserMenu";

describe("UserMenu", () => {
  it("re-exports UserMenu from @foundry/ui", () => {
    expect(UserMenu).toBeDefined();
    expect(typeof UserMenu).toBe("function");
  });
});
